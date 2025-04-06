#!/bin/bash

# Extract RTP Port (Ensure it's from a valid source)
RTP_PORT=$(sudo netstat -anp | grep udp6 | grep 2409:40f2:3150:10 | awk '$5 == ":::*" {split($4,a,":"); print a[length(a)]}')
#grep waale me ipv6 address of sender
# Ensure the port is valid
if [[ -n "$RTP_PORT" ]]; then
    # Convert to little-endian format for 16-bit value
    BYTE1=$(printf '0x%02x' $(($RTP_PORT & 0xFF)))        # Least significant byte
    BYTE2=$(printf '0x%02x' $((($RTP_PORT >> 8) & 0xFF))) # Most significant byte
    echo "Updating WebRTC Port in BPF Map: $RTP_PORT -> $BYTE1 $BYTE2"
    # Update eBPF map with little-endian format
    sudo bpftool map update name dynamic_map_xdp key 00 00 00 00 value $BYTE1 $BYTE2
    sudo bpftool map update name dynamic_map_tc key 00 00 00 00 value $BYTE1 $BYTE2
    sudo bpftool map update name dynamic_map key 00 00 00 00 value $BYTE1 $BYTE2
else
    echo "No WebRTC port detected."
fi
