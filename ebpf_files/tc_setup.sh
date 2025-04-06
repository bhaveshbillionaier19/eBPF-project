#!/bin/bash

echo "======TC SETUP BEGINS======"
# Define network interface
INTERFACE="wlp0s20f3"  # Change this if needed

# Delete existing qdisc (if any)
sudo tc qdisc del dev $INTERFACE root 2>/dev/null

# Add HTB root qdisc with default class 20
sudo tc qdisc add dev $INTERFACE root handle 1: htb default 20

# VoIP Class (Strict Priority) with Min 30kbps and Max 10Mbps
sudo tc class add dev $INTERFACE parent 1: classid 1:10 htb rate 30kbps ceil 40kbps prio 1

# General Traffic Class (Remaining Bandwidth)
sudo tc class add dev $INTERFACE parent 1: classid 1:20 htb rate 499.97mbps ceil 500mbps prio 2

# FQ-CoDel for General Traffic
sudo tc qdisc add dev $INTERFACE parent 1:20 handle 20: fq_codel \
    limit 10000 target 5ms interval 100ms flows 8192 quantum 3000 memory_limit 128M ecn
#small codel for voip traffic to stabalize latency
sudo tc qdisc add dev wlp0s20f3 parent 1:10 handle 10: fq_codel \
    limit 500 target 2ms interval 40ms ecn

# Attach eBPF filter to detect and prioritize VoIP packets
sudo tc filter add dev $INTERFACE parent 1: protocol ipv6 prio 1 handle 1 bpf da obj ipout.o sec classifier

# Display the configured qdisc and filters
sudo tc qdisc show dev $INTERFACE
sudo tc class show dev $INTERFACE
sudo tc filter show dev $INTERFACE

echo "======TC SETUP DONE======"

