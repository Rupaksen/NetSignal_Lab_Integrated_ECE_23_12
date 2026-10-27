# NetSignal Lab V3 — Local / No Hatchable / No External API

This rebuild keeps the V2 NetSignal Lab concept and adds a functional Virtual Communication Kit.

## Run
1. Install Node.js.
2. `npm install`
3. `npm start`
4. Open `http://localhost:3000`

## Virtual Communication Kit
- Digital transmitter/receiver chain
- NRZ-L, NRZ-I, RZ, Manchester, Differential Manchester, AMI, Pseudoternary
- ASK, FSK, BPSK, QPSK, 16-QAM, 64-QAM
- AWGN channel, SNR, BER, recovered bits
- Animated transmitter and receiver waveforms
- Analog AM, FM and PM demonstration
- Separate coding reference viewer

## Backend
The backend is a small local plain Node.js HTTP server for health, local sessions and an optional Android radio bridge. No Cloudflare, third-party API, CDN, API key, or hosted platform is used.

## Network limitation
The network analyzer is intentionally local/simulated in this edition. Real Internet speed and modem-level LTE/5G radio measurements require an external network endpoint or an Android companion; this software does not fabricate those values.

## C++ DSP filter programming lab
- Write FIR/IIR filter programs in an educational C++ subset.
- Test input → output locally with waveform visualization.
- Measured frequency-response chart.
- FIR moving-average, IIR low-pass and FIR high-pass examples.
- Diagnostics include line/column and source pointer for mistakes.
- No native compiler or external API is required.

## C++ DSP runner fix
The C++ DSP educational runner accepts the standard `using namespace std;` statement used by the included examples. Expression/runtime errors are now mapped back to the source line and column instead of incorrectly reporting line 1 for every failure.
