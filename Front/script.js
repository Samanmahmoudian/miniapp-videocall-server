const localstream = document.getElementById('localstream');
const remotestream = document.getElementById('remotestream');
const muteBtn = document.getElementById('mutebtn')
const hideBtn = document.getElementById('hidebtn')
const switchBtn = document.getElementById('switchbtn')
const endBtn = document.getElementById('endbtn')

localstream.onplaying = function () {
    const loader = localstream.nextElementSibling;
    if (loader && loader.classList.contains('loader')) {
        loader.style.display = 'none';
    }
};

remotestream.onplaying = function () {
    const loader = remotestream.nextElementSibling;
    if (loader && loader.classList.contains('loader')) {
        loader.style.display = 'none';
    }
};

const socket = io('http://localhost:3000');

const peerConnectionConfig ={
    iceServers: [
        {
            url: 'stun:global.stun.twilio.com:3478',
            urls: 'stun:global.stun.twilio.com:3478'
          },
          {
            url: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: '831a2f384d43a34121a9c61d4a88371144523a35887d01dc1d5adacc34ef1e7a',
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            credential: 'y1pgmln8x7nYMcOZZNsU6TYdY1uQwG8aIc6PgiCq8BE='
          },
          {
            url: 'turn:global.turn.twilio.com:3478?transport=tcp',
            username: '831a2f384d43a34121a9c61d4a88371144523a35887d01dc1d5adacc34ef1e7a',
            urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
            credential: 'y1pgmln8x7nYMcOZZNsU6TYdY1uQwG8aIc6PgiCq8BE='
          },
          {
            url: 'turn:global.turn.twilio.com:443?transport=tcp',
            username: '831a2f384d43a34121a9c61d4a88371144523a35887d01dc1d5adacc34ef1e7a',
            urls: 'turn:global.turn.twilio.com:443?transport=tcp',
            credential: 'y1pgmln8x7nYMcOZZNsU6TYdY1uQwG8aIc6PgiCq8BE='
          },
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "stun:stun.l.google.com:19302",
          },
          {
            urls: "stun:global.stun.twilio.com:3478",
          },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "668aa7edae8119ac57b8985d",
          credential: "MRvEutvpeLKLHuQA",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "668aa7edae8119ac57b8985d",
          credential: "MRvEutvpeLKLHuQA",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "668aa7edae8119ac57b8985d",
          credential: "MRvEutvpeLKLHuQA",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "668aa7edae8119ac57b8985d",
          credential: "MRvEutvpeLKLHuQA",
        },
        
        { urls: "stun:stun.l.google.com:19302" }
    ],
  }

let myId;
let partnerId;
let stream
let isMuted = false;
let isHidden = false;
let camera_view = 'user'
let peerConnection 

async function shareMedia(){
    try{
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:camera_view} , audio:true})
        localstream.srcObject = await stream
    }catch{
        console.log('camera denied')
        socket.emit('error' , `camera denied` )
    }

}
shareMedia()


async function endpeer(){
    await peerConnection.close()
    remotestream.srcObject = null
    const loader = remotestream.nextElementSibling;
    if (loader && loader.classList.contains('loader')) {
        loader.style.display = '';
    }
    socket.emit('startnewcall' , 'ended')
    partnerId = ''
}
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
});

hideBtn.addEventListener('click', () => {
    isHidden = !isHidden;
    stream.getVideoTracks().forEach(track => track.enabled = !isHidden);
    hideBtn.textContent = isHidden ? 'Show' : 'Hide';
});

switchBtn.addEventListener('click', async () => {
    camera_view = camera_view === 'user' ? 'environment' : 'user';
    if (stream) {
        stream.getTracks().forEach(track => track.stop()); 
    }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camera_view }, audio: true });
        localstream.srcObject = stream;
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
            if (sender.track.kind === "video") {
                sender.replaceTrack(stream.getVideoTracks()[0]);
            }
            if (sender.track.kind === "audio") {
                sender.replaceTrack(stream.getAudioTracks()[0]);
            }
        });

    } catch (error) {
        console.log('Failed to switch camera:', error);
    }
});




endBtn.addEventListener('click', () => {
    peerConnection.close();
    socket.emit('endcall' , {endcall:'ended' , to:partnerId})
    remotestream.srcObject = null
    const loader = remotestream.nextElementSibling;
    if (loader && loader.classList.contains('loader')) {
        loader.style.display = '';
    }
    alert('Call Ended');
    window.close();
});

socket.on('endcall' , async(endcall)=>{
    if(endcall){
        await endpeer()
    }
})

socket.on('my_id', (id) => {
    myId = id;
    console.log("My ID:", myId);
});

socket.on('offer_state', async (offer) => {
    peerConnection = new RTCPeerConnection(peerConnectionConfig)
    if (offer.state == 'ready') {
        partnerId = await offer.partnerId;
        console.log('Your partner id is: ' + offer.partnerId);
        startOffer()
    } else if (offer.state == 'connected') {
        partnerId = await offer.partnerId;
        console.log('Your partner id is: ' + offer.partnerId);

    }
})

async function startOffer(){
    if(!stream){
        await shareMedia()
    }
     stream.getTracks().forEach(async(track)=>{
        await peerConnection.addTrack(track , stream)
        console.log('track added')
    })
    peerConnection.ontrack = (event)=>{
        console.log( event.streams[0])
        remotestream.srcObject = event.streams[0]
    }
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            try {
                socket.emit('ice', {ice: event.candidate, to: partnerId});
            } catch (error) {
                console.error('Error sending ICE candidate:', error);
            }
        }
    }
    const offer = await peerConnection.createOffer();
    console.log(`offer : ${offer.sdp}`)
    socket.emit('error' , `offer : ${offer.sdp}` )
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', {offer: offer, to: partnerId});
}

socket.on('offer', async (offer) => {
    try {
        if(!stream){
            await shareMedia()
        }
         stream.getTracks().forEach(async(track)=>{
            await peerConnection.addTrack(track , stream)
            console.log('track added')
        })
        peerConnection.ontrack = (event)=>{
            console.log( event.streams[0])
            remotestream.srcObject = event.streams[0]
        }
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    socket.emit('ice', {ice: event.candidate, to: partnerId});
                    socket.emit('error' , `${event.candidate}` )
                } catch (error) {
                    console.error('Error sending ICE candidate:', error);
                }
            }
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', {answer: answer, to: partnerId});
    } catch (error) {
        console.error('Error handling offer:', error);
    }
})

socket.on('answer', async (answer) => {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
})



socket.on('ice', async(ice) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(ice));
        
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
})

socket.on('disconnected', async(messege)=>{
    if(partnerId == messege){
        await endpeer()

    }
})
