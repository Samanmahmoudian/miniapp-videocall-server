
const localstream = document.getElementById('localstream')
const remotestream = document.getElementById('remotestream')

const socket = io('http://localhost:3000');

const peerConnection = new RTCPeerConnection({
    iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "38ee091c80ce59e7934dc880",
          credential: "DCdxPjEpZcziiiKk",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "38ee091c80ce59e7934dc880",
          credential: "DCdxPjEpZcziiiKk",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "38ee091c80ce59e7934dc880",
          credential: "DCdxPjEpZcziiiKk",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "38ee091c80ce59e7934dc880",
          credential: "DCdxPjEpZcziiiKk",
        },
    ],
  });
           

navigator.mediaDevices.getUserMedia({video:true , audio:true}).then((stream)=>{
  stream.getTracks().forEach((track)=>{
      peerConnection.addTrack(track , stream)
  })
  localstream.srcObject = stream
})





localstream.onplaying = function() {
    const loader = localstream.nextElementSibling;
    if (loader && loader.classList.contains('loader')) {
        loader.style.display = 'none';
    }
};


socket.on('offer', async (offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("Connected successfully")
});

peerConnection.ontrack = async (event)=>{
    remotestream.srcObject = await event.streams[0]
    remotestream.onplaying = function() {
        const loader = remotestream.nextElementSibling;
        if (loader && loader.classList.contains('loader')) {
            loader.style.display = 'none';
        }
    };

}
peerConnection.onicecandidate = async (event)=>{
  if(event.candidate){
    await socket.emit('ice' , event.candidate)
  }
}

socket.on('ice', async (ice) => {
    await peerConnection.addIceCandidate(new RTCIceCandidate(ice));
    console.log(ice)
});

async function sendOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
}

peerConnection.onnegotiationneeded = sendOffer