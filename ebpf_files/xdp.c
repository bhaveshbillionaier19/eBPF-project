#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ipv6.h>
#include <linux/udp.h>
#include <bpf/bpf_helpers.h>
#include <netinet/in.h>
#include <bpf/bpf_endian.h>

struct{
	__uint(type, BPF_MAP_TYPE_HASH);
	__uint(max_entries, 1);
	__type(key, __u32);
	__type(value, __u16);
}dynamic_map_xdp SEC(".maps");

SEC("xdp")
int xdp_voip_security(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    struct ethhdr *eth = data;
   
    // Ensure there's space for the Ethernet header
    if ((void *)(eth + 1) > data_end)
       { return XDP_PASS;}

    struct ipv6hdr *ip6 = (void *)(eth + 1);
   
    // Ensure there's space for the IPv6 header
    if ((void *)(ip6 + 1) > data_end)
        {return XDP_PASS;}

    // Process only UDP packets
    if (ip6->nexthdr != IPPROTO_UDP)
       { return XDP_PASS;}

    struct udphdr *udp = (void *)(ip6 + 1);

    // Ensure there's space for the UDP header
    if ((void *)(udp + 1) > data_end)
       { return XDP_PASS;}
    // Get destination port
    __u16 dest_port = bpf_ntohs(udp->dest);
	__u32 key = 0;
	__u16 *value;
	value = bpf_map_lookup_elem(&dynamic_map_xdp, &key);
if(value){
	__u16 rtp_port_xdp = *value;
   	 if (dest_port == rtp_port_xdp) {
		ip6->priority = 0x0B;
		ip6->flow_lbl[0] = (ip6->flow_lbl[0] & 0x0F) | (0x0A<<4);
		bpf_printk("YES");
       		return XDP_PASS;
   	 }
}
	ip6->priority = 0x00;
	ip6->flow_lbl[0] = (ip6->flow_lbl[0] & 0x0F)|(0<<4);

	return XDP_PASS;
}


char _license[] SEC("license") = "GPL";
