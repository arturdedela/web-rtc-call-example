import "./style.css";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  getDoc,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAvXOAmjXDb_VNU7DZR9zYnY2C12976rEI",
  authDomain: "learn-webrtc-a1f1b.firebaseapp.com",
  projectId: "learn-webrtc-a1f1b",
  storageBucket: "learn-webrtc-a1f1b.appspot.com",
  messagingSenderId: "717903639786",
  appId: "1:717903639786:web:3232062825f78faad19393",
  measurementId: "G-XEPR54NJM6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const firestore = getFirestore(app);

const configuration: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(configuration);
// let localWebcamStream: MediaStream;
// let remoteStream: MediaStream;

// HTML elements
const webcamButton = document.getElementById(
  "webcamButton"
) as HTMLButtonElement;
const webcamVideo = document.getElementById("webcamVideo") as HTMLVideoElement;
const callButton = document.getElementById("callButton") as HTMLButtonElement;
const callInput = document.getElementById("callInput") as HTMLInputElement;
const answerButton = document.getElementById(
  "answerButton"
) as HTMLButtonElement;
const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
const hangupButton = document.getElementById(
  "hangupButton"
) as HTMLButtonElement;

webcamButton?.addEventListener("click", async () => {
  const localWebcamStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  const remoteStream: MediaStream = new MediaStream();

  localWebcamStream.getTracks().forEach((track) => {
    pc.addTrack(track, localWebcamStream);
  });

  pc.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  });

  webcamVideo.srcObject = localWebcamStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
});

callButton?.addEventListener("click", async () => {
  const callReference = doc(collection(firestore, "calls"));
  const offerCandidates = collection(callReference, "offerCandidates");
  const answerCandidates = collection(callReference, "answerCandidates");

  // Get candidates for caller, save to db
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  });

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await setDoc(callReference, { offer });
  const callId = callReference.id;
  document.querySelector("#callId")!.innerHTML = callId;

  onSnapshot(callReference, (snapshot) => {
    const call = snapshot.data();
    if (call?.answer) {
      const answerDescription = new RTCSessionDescription(call.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const iceCandidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(iceCandidate);
      }
    });
  });

  hangupButton.disabled = false;
});

answerButton.addEventListener("click", async () => {
  const callId = callInput.value;
  const callReference = doc(collection(firestore, "calls"), callId);
  const offerCandidates = collection(callReference, "offerCandidates");
  const answerCandidates = collection(callReference, "answerCandidates");

  const callDoc = await getDoc(callReference);

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  });

  const call = callDoc.data();
  if (call?.offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(call.offer));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    updateDoc(callReference, { answer });
  }

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const iceCandidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(iceCandidate);
      }
    });
  });
});

hangupButton.addEventListener("click", () => {
  pc.close();
});
