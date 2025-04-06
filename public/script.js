
const socket = io();
let peer;
let localStream;
let isMuted = false;
const jitterLog = [];
const bitrateLog = [];
let statsInterval;
let lastBytesReceived = 0;
let lastTimestamp = 0;

// Get microphone access
navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    localStream = stream;
    document.getElementById("muteButton").disabled = false;
    document.getElementById("endCall").disabled = false;
});

// ✅ Set up Chart.js for Real-Time Graphing
const ctxJitter = document.getElementById("jitterChart").getContext("2d");
const ctxBitrate = document.getElementById("bitrateChart").getContext("2d");

const jitterChart = new Chart(ctxJitter, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Jitter (ms)", borderColor: "red", data: [] }] },
    options: { scales: { x: { title: { display: true, text: "Time (s)" } }, y: { title: { display: true, text: "Jitter (ms)" } } } }
});

const bitrateChart = new Chart(ctxBitrate, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Bitrate (Kbps)", borderColor: "blue", data: [] }] },
    options: { scales: { x: { title: { display: true, text: "Time (s)" } }, y: { title: { display: true, text: "Bitrate (Kbps)" } } } }
});

// const rtcConfig = {
//     iceServers: [{ urls: "stun:stun.l.google.com:19302" }],  // ✅ Google STUN server
//     iceCandidatePoolSize: 10,
//     bundlePolicy: "max-bundle",
//     rtcpMuxPolicy: "require",
//     portRange: { min: 10000, max: 20000 }  // ✅ Restrict WebRTC to 10000-20000
// };


// Start WebRTC call
document.getElementById("startCall").addEventListener("click", () => {
    peer = new SimplePeer({ initiator: location.hash === "#1", trickle: false, stream: localStream });

    peer.on("signal", (data) => {
        socket.emit("signal", data);
    });

    peer.on("stream", (remoteStream) => {
        document.getElementById("audioElement").srcObject = remoteStream;
        document.getElementById("callStatus").innerText = "Connected!";
        
        let time = 0;

        // ✅ Start Jitter & Correct Bitrate Monitoring
        statsInterval = setInterval(() => {
            if (peer && peer._pc) {
                peer._pc.getStats(null).then(stats => {
                    stats.forEach(report => {
                        if (report.type === "inbound-rtp" && report.kind === "audio") {
                            const jitterValue = Math.round(report.jitter * 1000); // Convert to ms

                            // ✅ Calculate bitrate correctly
                            const currentBytesReceived = report.bytesReceived;
                            const currentTimestamp = report.timestamp;

                            let bitrate = 0;
                            if (lastTimestamp > 0) {
                                const timeDiff = (currentTimestamp - lastTimestamp) / 1000; // Convert ms to seconds
                                const bytesDiff = currentBytesReceived - lastBytesReceived;
                                bitrate = Math.round((bytesDiff * 8) / (timeDiff * 1000)); // Convert to Kbps
                            }

                            lastBytesReceived = currentBytesReceived;
                            lastTimestamp = currentTimestamp;

                            console.log(`Jitter: ${jitterValue} ms, Bitrate: ${bitrate} Kbps`);

                            // ✅ Update UI
                            document.getElementById("jitterDisplay").innerText = `Jitter: ${jitterValue} ms`;
                            document.getElementById("bitrateDisplay").innerText = `Bitrate: ${bitrate} Kbps`;

                            // ✅ Store for Graphs & Averages
                            jitterLog.push(jitterValue);
                            bitrateLog.push(bitrate);

                            // ✅ Update Graphs in Real-Time
                            jitterChart.data.labels.push(time);
                            jitterChart.data.datasets[0].data.push(jitterValue);
                            jitterChart.update();

                            bitrateChart.data.labels.push(time);
                            bitrateChart.data.datasets[0].data.push(bitrate);
                            bitrateChart.update();

                            time++;
                        }
                    });
                }).catch(error => console.error("getStats() failed:", error));
            }
        }, 1000);

    });

    socket.on("signal", (data) => {
        peer.signal(data);
    });

    console.log("Call started");

    
});

// End Call
document.getElementById("endCall").addEventListener("click", () => {
    if (peer) {
        peer.destroy();
        peer = null;
        console.log("Call ended");

        // ✅ Stop Jitter & Bitrate Monitoring
        clearInterval(statsInterval);

        // ✅ Calculate & Display Averages
        const avgJitter = (jitterLog.reduce((a, b) => a + b, 0) / jitterLog.length) || 0;
        const avgBitrate = (bitrateLog.reduce((a, b) => a + b, 0) / bitrateLog.length) || 0;

        document.getElementById("avgJitter").innerText = `${avgJitter.toFixed(2)} ms`;
        document.getElementById("avgBitrate").innerText = `${avgBitrate.toFixed(2)} Kbps`;
    }
    document.getElementById("audioElement").srcObject = null;
    document.getElementById("callStatus").innerText = "Call Ended";
});


document.addEventListener("DOMContentLoaded", function() {
    const startCall = document.getElementById("startCall");
    const muteButton = document.getElementById("muteButton");
    const endCall = document.getElementById("endCall");

    // Ensure correct initial state on page load
    startCall.disabled = false;
    muteButton.disabled = true;
    endCall.disabled = true;

    // Apply styles explicitly for disabled buttons
    muteButton.style.opacity = "0.4";
    muteButton.style.cursor = "not-allowed";
    muteButton.style.background= "#424549";
    endCall.style.opacity = "0.4";
    endCall.style.cursor = "not-allowed";
    endCall.style.background= "#424549";

    startCall.addEventListener("click", function() {
        startCall.disabled = true;  
        muteButton.disabled = false; 
        endCall.disabled = false;

        // Change styles to make them active
        muteButton.style.opacity = "1";
        muteButton.style.cursor = "pointer";
        muteButton.style.background=" #5865F2";
        endCall.style.opacity = "1";
        endCall.style.cursor = "pointer";
        endCall.style.background=" #5865F2";
    });

    endCall.addEventListener("click", function() {
        startCall.disabled = false;
        muteButton.disabled = true;
        endCall.disabled = true;

        // Reset styles for disabled buttons
        muteButton.style.opacity = "0.4";
        muteButton.style.cursor = "not-allowed";
        muteButton.style.background= "#424549";
        endCall.style.opacity = "0.4";
        endCall.style.cursor = "not-allowed";
        endCall.style.background= "#424549";
    });
});

document.getElementById("muteButton").addEventListener("click", function () {
    let icon = this.querySelector("i");

    // Ensure there's an active stream
    if (!localStream) {
        console.error("No active media stream found.");
        return;
    }

    // Get audio tracks
    let audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.error("No audio tracks available.");
        return;
    }

    // Toggle Mute
    let isMuted = !audioTracks[0].enabled;
    audioTracks.forEach(track => track.enabled = isMuted);

    // Update Icon and State
    if (isMuted) {
        icon.classList.remove("fa-microphone-slash");
        icon.classList.add("fa-microphone");
        this.classList.remove("muted");
    } else {
        icon.classList.remove("fa-microphone");
        icon.classList.add("fa-microphone-slash");
        this.classList.add("muted");
    }

    console.log("Microphone Muted:", !isMuted);
});



