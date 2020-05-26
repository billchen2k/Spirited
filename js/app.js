let visualizer;
let recorder;
let isRecording = false;
let recordingBroken = false;
var audioFileURL;
const PLAYERS = {};

const model = initModel();
let player = initPlayers();

var slider = document.getElementById("progressSlider");

var sliderVal = 0;
var timer;
btnRecord.addEventListener('click', () => {
  // Things are broken on iOS
  if (!navigator.mediaDevices) {
    recordingBroken = true;
    recordingError.hidden = false;
    btnRecord.disabled = true;
    return;
  }
  if(player.isPlaying()){
    player.stop();
  }
    if (isRecording) {
    isRecording = false;
    updateRecordBtn(true);
    recorder.stop();
  } else {
    // Request permissions to record audio.
    navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
      isRecording = true;
      updateRecordBtn(false);
      hideVisualizer();
      recorder = new window.MediaRecorder(stream);
      recorder.addEventListener('dataavailable', (e) => {
         audioFileURL = URL.createObjectURL(e.data)
         updateWorkingState(btnRecord, btnUpload);
         requestAnimationFrame(() => requestAnimationFrame(() => transcribeFromFile(e.data)));
      });
      recorder.start();
    }, (error) => {
      console.error(error)
      recordingBroken = true;
      recordingError.hidden = false;
      btnRecord.disabled = true;
    });
  }
});

fileInput.addEventListener('change', (e) => {
  recordingError.hidden = true;
  updateWorkingState(btnUpload, btnRecord);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    transcribeFromFile(e.target.files[0]);
    fileInput.value = null;
  }));

  return false;
});

container.addEventListener('click', () => {
  if (player.isPlaying()) {
    stopPlayer();
  } else {
    startPlayer();
  }
});

async function transcribeFromFile(blob) {

  hideVisualizer();
  model.transcribeFromAudioFile(blob).then((ns) => {
    PLAYERS.soundfont.loadSamples(ns).then(() => {
      visualizer = new mm.PianoRollCanvasVisualizer(ns, canvas, {
          noteRGB: '255, 255, 255',
          activeNoteRGB: '60, 191, 203',
          pixelsPerTimeStep: window.innerWidth < 500 ? null: 80,
      });

      slider.max = visualizer.noteSequence.totalTime.toFixed(1);
      totalTime.innerText = visualizer.noteSequence.totalTime.toFixed(1) + " s";
      currentTime.innerText =  "0 s";

      slider.addEventListener("change", ()=>{
        window.clearInterval(timer);
        var t = parseFloat(slider.value);
        console.log("Seek to: " + t);
        const playing = (player.isPlaying());
        if (playing) {
          player.pause();
          player.seekTo(t);
          player.resume();
          timer = window.setInterval(()=> updateSlider(4), 250);
        }
        else{
          startPlayer();
          window.setTimeout( () => player.seekTo(t + 0.5), 500);
        }
        sliderVal = t
      })
      resetUIState();
      showVisualizer();
    });
  });
}

function setActivePlayer(event, isSynthPlayer) {
  document.querySelector('button.player.active').classList.remove('active');
  event.target.classList.add('active');
  stopPlayer();
  player = isSynthPlayer ? PLAYERS.synth : PLAYERS.soundfont;
  startPlayer();
}


function updateSlider (gap) {
  if(player.isPlaying()){
    sliderVal = sliderVal + 1 / gap;
    slider.value = sliderVal;
    currentTime.innerText = sliderVal.toFixed(1) + " s"
  }
}

function stopPlayer() {
  player.stop();
  container.classList.remove('playing');
  window.clearInterval(timer);
  sliderVal = slider.value = 0;
  currentTime.innerText = "0 s"
}

function startPlayer() {
  sliderVal = 0;
  timer = window.setInterval(() => updateSlider(4), 250);
  container.scrollLeft = 0;
  container.classList.add('playing');
  mm.Player.tone.context.resume();
  ns = visualizer.noteSequence;
  if(player === PLAYERS.synth){
    let instrument = 81
    ns.notes.forEach(n => n.program = instrument)
  }
  else{
    ns.notes.forEach(n => n.program = 0)
  }
  player.start(ns);
}

function updateWorkingState(active, inactive) {
  player.stop();
  help.hidden = true;
  transcribingMessage.hidden = false;
  active.classList.add('working');
  inactive.setAttribute('disabled', true);
}

function updateRecordBtn(defaultState) {
  const el = btnRecord.firstElementChild;
  el.innerHTML = defaultState ? '<span class="mdi mdi-microphone"></span> 录制音频' : '<span class="mdi mdi-stop"></span> 停止';
  // el.textContent = defaultState ? '<span class="mdi mdi-microphone"></span> 录制音频' : '<span class="mdi mdi-stop"></span> 停止';
}

function resetUIState() {
  btnUpload.classList.remove('working');
  btnUpload.removeAttribute('disabled');
  btnRecord.classList.remove('working');
  if (!recordingBroken) {
    btnRecord.removeAttribute('disabled');
  }
}

function hideVisualizer() {
  players.hidden = true;
  saveBtn.hidden = true;
  container.hidden = true;
  resultButtons.hidden = true;
}

function showVisualizer() {
  container.hidden = false;
  saveBtn.hidden = false;
  document.getElementById("saveFileBtn").hidden = false;
  players.hidden = false;
  transcribingMessage.hidden = true;
  help.hidden = true;
  resultButtons.hidden = false;
}

function saveMidi(event) {
  event.stopImmediatePropagation();
  saveAs(new File([mm.sequenceProtoToMidi(visualizer.noteSequence)], 'transcription.mid'));
}

function initPlayers() {
  PLAYERS.synth = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
  PLAYERS.synth.callbackObject = {
    run: (note) => {
      // slider.value = note.startTime.toFixed(1);
      const currentNotePosition = visualizer.redraw(note);

      // See if we need to scroll the container.
      const containerWidth = container.getBoundingClientRect().width;
      if (currentNotePosition > (container.scrollLeft + containerWidth)) {
        container.scrollLeft = currentNotePosition - 20;
      }
    },
    stop: () => {container.classList.remove('playing')}
  }
  //
  // PLAYERS.synth = new mm.Player(false, {
  //   run: (note) => {
  //     const currentNotePosition = visualizer.redraw(note);
  //     // Update slider
  //
  //     slider.value = note.startTime.toFixed(1);
  //     // See if we need to scroll the container.
  //     const containerWidth = container.getBoundingClientRect().width;
  //     if (currentNotePosition > (container.scrollLeft + containerWidth)) {
  //       container.scrollLeft = currentNotePosition - 20;
  //     }
  //   },
  //   stop: () => {container.classList.remove('playing')}
  // });

  PLAYERS.soundfont = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/salamander');

  // TODO: fix this after magenta 1.1.15
  PLAYERS.soundfont.callbackObject = {
    run: (note) => {
      const currentNotePosition = visualizer.redraw(note);

      // slider.value = note.startTime.toFixed(1);
      // currentTime.innerText = note.startTime.toFixed(1) + " s"

      // See if we need to scroll the container.
      const containerWidth = container.getBoundingClientRect().width;
      if (currentNotePosition > (container.scrollLeft + containerWidth)) {
        container.scrollLeft = currentNotePosition - 20;
      }
    },
    stop: () => {container.classList.remove('playing')}
  };
  return PLAYERS.soundfont;
}

function initModel() {
  // const model = new mm.OnsetsAndFrames('https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni');
  const model = new mm.OnsetsAndFrames('model/onsets_frames_uni');
  model.initialize().then(() => {
    resetUIState();

    $("#modelReady").slideDown()
    $("#modelLoading").slideUp()
    // modelLoading.hidden = true;

  });

  // Things are slow on Safari.
  if (window.webkitOfflineAudioContext) {
    safariWarning.hidden = false;
  }

  // Things are very broken on ios12.
  if (navigator.userAgent.indexOf('iPhone OS 12_0') >= 0) {
    iosError.hidden = false;
    buttons.hidden = true;
  }
  return model;
}

function saveFile() {
  const link = document.createElement('a');
  link.href = audioFileURL;
  link.download = 'recording.wav';
  link.click();
  console.log('Recording URL: ' + audioFileURL)
}

$("box-top").css("height", modelLoading.style.height)