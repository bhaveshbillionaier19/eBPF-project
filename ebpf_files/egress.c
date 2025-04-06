#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <linux/pkt_cls.h>
#include <linux/if_ether.h>
#include <linux/ipv6.h>
#include <linux/udp.h>
#include <bpf/bpf_endian.h>
#include <netinet/in.h>

struct{
	__uint(type, BPF_MAP_TYPE_HASH);
	__uint(max_entries, 1);
	__type(key, __u32);
	__type(value, __u16);
}dynamic_map SEC(".maps");


SEC("classifier")
int classify_voip_hybrid_v6(struct __sk_buff *skb) {
    void *data_end = (void *)(long)skb->data_end;
    void *data = (void *)(long)skb->data;

    // Boundary checks for Ethernet + IPv6 + UDP
    if (data + sizeof(struct ethhdr) + sizeof(struct ipv6hdr) + sizeof(struct udphdr) > data_end)
        return TC_ACT_OK;

    struct ethhdr *eth = data;
    struct ipv6hdr *ip6 = (void *)(eth + 1);

    // Check if it's UDP
    if (ip6->nexthdr != IPPROTO_UDP)
        return TC_ACT_OK;

    struct udphdr *udp = (void *)(ip6 + 1);
    __u16 src_port = bpf_ntohs(udp->source);
	__u32 key = 0;
	__u16 *value;
	value = bpf_map_lookup_elem(&dynamic_map, &key);
	
if(value){
    // VoIP Packet Classification
	__u16 rtp_port = *value;
	bpf_printk("rtp port is %u", rtp_port);
	bpf_printk("src port is %u", src_port);
    if (src_port == rtp_port) {
        skb->priority = 1; // High priority
	ip6->priority = 0x0B;
	ip6->flow_lbl[0] = (ip6->flow_lbl[0] & 0x0F) | (0x0A<<4);
        bpf_printk("IPv6 Egress VoIP Packet Prioritized: Port %d\n", src_port);
        return TC_ACT_OK;
    }
    return TC_ACT_OK;
}

    return TC_ACT_OK;
}

char _license[] SEC("license") = "GPL";
