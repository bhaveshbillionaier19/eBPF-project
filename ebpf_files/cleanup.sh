#!/bin/bash

INTERFACE="wlp0s20f3"  # Replace with your actual interface
IFB_DEV="ifb0"

echo "======CLEANING BEGINS======"

# Detach ingress qdisc from the main interface
sudo tc qdisc del dev $INTERFACE ingress 2>/dev/null

# Delete root qdisc from the IFB device
sudo tc qdisc del dev $IFB_DEV root 2>/dev/null

# Delete the IFB device
sudo ip link set $IFB_DEV down 2>/dev/null
sudo ip link delete $IFB_DEV type ifb 2>/dev/null

#delete tc program
sudo tc qdisc del dev $INTERFACE root

echo "======CLEANING DONE======"
