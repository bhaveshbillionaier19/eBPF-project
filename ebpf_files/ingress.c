#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <linux/pkt_cls.h>
#include <linux/if_ether.h>
#include <linux/ipv6.h>
#include <linux/udp.h>
#include <bpf/bpf_endian.h>
#include <netinet/in.h>

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, __u16);
} dynamic_map_tc SEC(".maps");

SEC("classifier")  // TC Ingress Program
int classify_voip_v6(struct __sk_buff *skb) {
    void *data = (void *)(long)skb->data;
    void *data_end = (void *)(long)skb->data_end;

    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end) return TC_ACT_OK;

    // Ensure it's IPv6
    if (eth->h_proto != bpf_htons(ETH_P_IPV6)) return TC_ACT_OK;

    struct ipv6hdr *ip6 = (void *)(eth + 1);
    if ((void *)(ip6 + 1) > data_end) return TC_ACT_OK;

    if (ip6->nexthdr != IPPROTO_UDP) return TC_ACT_OK;

    struct udphdr *udp = (void *)(ip6 + 1);
    if ((void *)(udp + 1) > data_end) return TC_ACT_OK;

    __u16 dest_port = bpf_ntohs(udp->dest);
    __u32 key = 0;
    __u16 *value = bpf_map_lookup_elem(&dynamic_map_tc, &key);

    if (value) {
        __u16 rtp_port = *value;
        bpf_printk("RTCP/RTP port: %u, dest port: %u", rtp_port, dest_port);
        if (dest_port == rtp_port) {
            skb->priority = 1; // High priority
            bpf_printk("Ingress VoIP Packet Prioritized: Port %d", dest_port);
            return TC_ACT_OK;
        }
    }
    return TC_ACT_OK;
}

char _license[] SEC("license") = "GPL";
