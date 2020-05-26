/*
The MIT License (MIT)

Copyright 2017 Andrey Sitnik <andrey@sitnik.ru>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var MediaRecorder = require("audio-recorder-polyfill");
if (!window.MediaRecorder) {
    console.log('Using the MediaRecorder polyfill.');
    window.MediaRecorder = MediaRecorder;
}

},{"audio-recorder-polyfill":2}],2:[function(require,module,exports){
var AudioContext = window.AudioContext || window.webkitAudioContext

function createWorker (fn) {
  var js = fn
    .toString()
    .replace(/^function\s*\(\)\s*{/, '')
    .replace(/}$/, '')
  var blob = new Blob([js])
  return new Worker(URL.createObjectURL(blob))
}

var context

/**
 * Audio Recorder with MediaRecorder API.
 *
 * @param {MediaStream} stream The audio stream to record.
 *
 * @example
 * navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
 *   var recorder = new MediaRecorder(stream)
 * })
 *
 * @class
 */
function MediaRecorder (stream) {
  /**
   * The `MediaStream` passed into the constructor.
   * @type {MediaStream}
   */
  this.stream = stream

  /**
   * The current state of recording process.
   * @type {"inactive"|"recording"|"paused"}
   */
  this.state = 'inactive'

  this.em = document.createDocumentFragment()
  this.encoder = createWorker(MediaRecorder.encoder)

  var recorder = this
  this.encoder.addEventListener('message', function (e) {
    var event = new Event('dataavailable')
    event.data = new Blob([e.data], { type: recorder.mimeType })
    recorder.em.dispatchEvent(event)
    if (recorder.state === 'inactive') {
      recorder.em.dispatchEvent(new Event('stop'))
    }
  })
}

MediaRecorder.prototype = {
  /**
   * The MIME type that is being used for recording.
   * @type {string}
   */
  mimeType: 'audio/wav',

  /**
   * Begins recording media.
   *
   * @param {number} [timeslice] The milliseconds to record into each `Blob`.
   *                             If this parameter isn’t included, single `Blob`
   *                             will be recorded.
   *
   * @return {undefined}
   *
   * @example
   * recordButton.addEventListener('click', function () {
   *   recorder.start()
   * })
   */
  start: function start (timeslice) {
    if (this.state === 'inactive') {
      this.state = 'recording'

      if (!context) {
        context = new AudioContext()
      }
      var input = context.createMediaStreamSource(this.stream)
      var processor = context.createScriptProcessor(2048, 1, 1)

      var recorder = this
      processor.onaudioprocess = function (e) {
        if (recorder.state === 'recording') {
          recorder.encoder.postMessage([
            'encode', e.inputBuffer.getChannelData(0)
          ])
        }
      }

      input.connect(processor)
      processor.connect(context.destination)

      this.em.dispatchEvent(new Event('start'))

      if (timeslice) {
        this.slicing = setInterval(function () {
          if (recorder.state === 'recording') recorder.requestData()
        }, timeslice)
      }
    }
  },

  /**
   * Stop media capture and raise `dataavailable` event with recorded data.
   *
   * @return {undefined}
   *
   * @example
   * finishButton.addEventListener('click', function () {
   *   recorder.stop()
   * })
   */
  stop: function stop () {
    if (this.state !== 'inactive') {
      this.requestData()
      this.state = 'inactive'
      clearInterval(this.slicing)
    }
  },

  /**
   * Pauses recording of media streams.
   *
   * @return {undefined}
   *
   * @example
   * pauseButton.addEventListener('click', function () {
   *   recorder.pause()
   * })
   */
  pause: function pause () {
    if (this.state === 'recording') {
      this.state = 'paused'
      this.em.dispatchEvent(new Event('pause'))
    }
  },

  /**
   * Resumes media recording when it has been previously paused.
   *
   * @return {undefined}
   *
   * @example
   * resumeButton.addEventListener('click', function () {
   *   recorder.resume()
   * })
   */
  resume: function resume () {
    if (this.state === 'paused') {
      this.state = 'recording'
      this.em.dispatchEvent(new Event('resume'))
    }
  },

  /**
   * Raise a `dataavailable` event containing the captured media.
   *
   * @return {undefined}
   *
   * @example
   * this.on('nextData', function () {
   *   recorder.requestData()
   * })
   */
  requestData: function requestData () {
    if (this.state !== 'inactive') {
      this.encoder.postMessage(['dump', context.sampleRate])
    }
  },

  /**
   * Add listener for specified event type.
   *
   * @param {"start"|"stop"|"pause"|"resume"|"dataavailable"} type Event type.
   * @param {function} listener The listener function.
   *
   * @return {undefined}
   *
   * @example
   * recorder.addEventListener('dataavailable', function (e) {
   *   audio.src = URL.createObjectURL(e.data)
   * })
   */
  addEventListener: function addEventListener () {
    this.em.addEventListener.apply(this.em, arguments)
  },

  /**
   * Remove event listener.
   *
   * @param {"start"|"stop"|"pause"|"resume"|"dataavailable"} type Event type.
   * @param {function} listener The same function used in `addEventListener`.
   *
   * @return {undefined}
   */
  removeEventListener: function removeEventListener () {
    this.em.removeEventListener.apply(this.em, arguments)
  },

  /**
   * Calls each of the listeners registered for a given event.
   *
   * @param {Event} event The event object.
   *
   * @return {boolean} Is event was no canceled by any listener.
   */
  dispatchEvent: function dispatchEvent () {
    this.em.dispatchEvent.apply(this.em, arguments)
  }
}

/**
 * Returns `true` if the MIME type specified is one the polyfill can record.
 *
 * This polyfill supports only `audio/wav`.
 *
 * @param {string} mimeType The mimeType to check.
 *
 * @return {boolean} `true` on `audio/wav` MIME type.
 */
MediaRecorder.isTypeSupported = function isTypeSupported (mimeType) {
  return /audio\/wave?/.test(mimeType)
}

/**
 * `true` if MediaRecorder can not be polyfilled in the current browser.
 * @type {boolean}
 *
 * @example
 * if (MediaRecorder.notSupported) {
 *   showWarning('Audio recording is not supported in this browser')
 * }
 */
MediaRecorder.notSupported = !navigator.mediaDevices || !AudioContext

/**
 * Converts RAW audio buffer to compressed audio files.
 * It will be loaded to Web Worker.
 * By default, WAVE encoder will be used.
 * @type {function}
 *
 * @example
 * MediaRecorder.prototype.mimeType = 'audio/ogg'
 * MediaRecorder.encoder = oggEncoder
 */
MediaRecorder.encoder = require('./wave-encoder')

module.exports = MediaRecorder

},{"./wave-encoder":3}],3:[function(require,module,exports){
// Copied from https://github.com/chris-rudmin/Recorderjs

module.exports = function () {
  var BYTES_PER_SAMPLE = 2

  var recorded = []

  function encode (buffer) {
    var length = buffer.length
    var data = new Uint8Array(length * BYTES_PER_SAMPLE)
    for (var i = 0; i < length; i++) {
      var index = i * BYTES_PER_SAMPLE
      var sample = buffer[i]
      if (sample > 1) {
        sample = 1
      } else if (sample < -1) {
        sample = -1
      }
      sample = sample * 32768
      data[index] = sample
      data[index + 1] = sample >> 8
    }
    recorded.push(data)
  }

  function dump (sampleRate) {
    var bufferLength = recorded.length ? recorded[0].length : 0
    var length = recorded.length * bufferLength
    var wav = new Uint8Array(44 + length)
    var view = new DataView(wav.buffer)

    // RIFF identifier 'RIFF'
    view.setUint32(0, 1380533830, false)
    // file length minus RIFF identifier length and file description length
    view.setUint32(4, 36 + length, true)
    // RIFF type 'WAVE'
    view.setUint32(8, 1463899717, false)
    // format chunk identifier 'fmt '
    view.setUint32(12, 1718449184, false)
    // format chunk length
    view.setUint32(16, 16, true)
    // sample format (raw)
    view.setUint16(20, 1, true)
    // channel count
    view.setUint16(22, 1, true)
    // sample rate
    view.setUint32(24, sampleRate, true)
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true)
    // block align (channel count * bytes per sample)
    view.setUint16(32, BYTES_PER_SAMPLE, true)
    // bits per sample
    view.setUint16(34, 8 * BYTES_PER_SAMPLE, true)
    // data chunk identifier 'data'
    view.setUint32(36, 1684108385, false)
    // data chunk length
    view.setUint32(40, length, true)

    for (var i = 0; i < recorded.length; i++) {
      wav.set(recorded[i], i * bufferLength + 44)
    }

    recorded = []
    postMessage(wav.buffer, [wav.buffer])
  }

  onmessage = function (e) {
    if (e.data[0] === 'encode') {
      encode(e.data[1])
    } else {
      dump(e.data[1])
    }
  }
}

},{}]},{},[1]);
