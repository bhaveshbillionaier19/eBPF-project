#!/bin/bash
# Replace with your actual interface name
INTERFACE="wlp0s20f3"
IFB_DEV="ifb0"

echo "======XDP SETUP BEGINS======"
# VoIP/WebRTC Settings
WEBRTC_PORT=$(sudo netstat -anp | grep udp6 | grep 2409:40f2:3150:10 | awk '$5 == ":::*" {split($4,a,":"); print a[length(a)]}')         # Common WebRTC port (update if different)
WEBRTC_DSCP_HEX="0xba"   # DSCP 46 + ECN 2 = 0xb8
WEBRTC_RATE="40kbps"
WEBRTC_CEIL="100kbps"

# General Traffic
GENERAL_RATE="497mbps"
GENERAL_CEIL="500mbps"

# Step 1: Setup IFB device
sudo modprobe ifb
sudo ip link add $IFB_DEV type ifb 2>/dev/null
sudo ip link set $IFB_DEV up

# Clean existing qdiscs
sudo tc qdisc del dev $INTERFACE ingress 2>/dev/null
sudo tc qdisc del dev $IFB_DEV root 2>/dev/null

# Step 2: Redirect ingress traffic to IFB
sudo tc qdisc add dev $INTERFACE handle ffff: ingress
sudo tc filter add dev $INTERFACE parent ffff: protocol all u32 match u32 0 0 action mirred egress redirect dev $IFB_DEV

# Step 3: Setup HTB root on IFB
sudo tc qdisc add dev $IFB_DEV root handle 1: htb default 20

# Class for WebRTC
sudo tc class add dev $IFB_DEV parent 1: classid 1:10 htb rate $WEBRTC_RATE ceil $WEBRTC_CEIL prio 1

# General traffic class
sudo tc class add dev $IFB_DEV parent 1: classid 1:20 htb rate $GENERAL_RATE ceil $GENERAL_CEIL prio 2

# Step 4: Attach FQ-CoDel to both classes
sudo tc qdisc add dev $IFB_DEV parent 1:10 handle 10: fq_codel limit 500 target 2ms interval 40ms ecn
sudo tc qdisc add dev $IFB_DEV parent 1:20 handle 20: fq_codel limit 10000 target 5ms interval 100ms flows 8192 quantum 3000 memory_limit 128M ecn

# Step 5: Filter WebRTC traffic (IPv6 + UDP + DSCP 46)
sudo tc filter add dev $IFB_DEV protocol ipv6 prio 1 flower \
    ip_proto udp \
    dst_port $WEBRTC_PORT \
    ip_tos $WEBRTC_DSCP_HEX \
    action classid 1:10

echo "======XDP SETUP DONE======"
