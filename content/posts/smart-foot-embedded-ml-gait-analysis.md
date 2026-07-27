---
title: "Smart Foot: Building an End-to-End Embedded-ML Gait Analysis System"
date: 2026-07-27
excerpt: "How I built a wearable plantar-pressure system from the ground up — 16-channel FSR sensing, a real-time bare-metal C pipeline, and an on-device neural network — and recorded my own dataset of 1,500+ gait samples from 50 subjects to train it."
tags: [embedded, TinyML, machine-learning, signal-processing, FSR, gait-analysis, firmware]
relatedProject: "Smart Foot"
---

# Smart Foot: Building an End-to-End Embedded-ML Gait Analysis System

*How I built a portable plantar-pressure and gait-analysis system from sensor to model to app — and why collecting my own dataset was the hardest and most valuable part.*

By **Muhammad Shafqat Ashraf** — Embedded, DSP & Firmware Systems Engineer

---

Most machine-learning projects start with a dataset someone else collected. This one started with an empty PCB.

Smart Foot is a portable biomechanical sensing system that reads pressure under the foot in real time, extracts gait features, and classifies walking patterns using a neural network running **on the device itself** — no cloud, no phone doing the heavy lifting. It was a research prototype, built to explore how far you can push sensor- and ML-based gait analysis on constrained embedded hardware. The interesting part is not any single piece; it is that I owned the whole chain, from the analog front end all the way to a trained model and a companion app.

This write-up walks through that chain, and spends the most time on the part that taught me the most: building the training dataset from scratch.

## The system at a glance

The pipeline has six stages, each feeding the next:

1. **Sensing** — a 16-sensor force-sensitive-resistor (FSR) array captures pressure across the sole.
2. **Acquisition** — a 12-bit ADC samples all channels at 100 Hz through analog multiplexing.
3. **Real-time firmware** — bare-metal C on an ARM Cortex-M microcontroller filters and normalizes the signal inside a 10 ms window.
4. **Feature extraction** — the firmware computes center-of-pressure, load distribution, symmetry, and gait phases.
5. **On-device inference** — a quantized INT8 TensorFlow Lite Micro model classifies the gait pattern in under 50 ms.
6. **Wireless + dashboard** — results and pressure heatmaps stream over BLE to a companion application.

Each stage has its own constraints, and the constraints are what make the engineering real.

## 1. Sensing: sixteen noisy analog channels

The foundation is a custom PCB carrying a 16-element piezoresistive FSR array. FSRs are cheap and thin, which is exactly what you want under a foot — but they are also nonlinear, drift with temperature, and vary unit to unit. Sixteen of them multiplexed onto one ADC means sixteen chances for crosstalk and noise to creep in.

Two decisions mattered here. First, **analog multiplexing** to read all sixteen channels without sixteen separate ADCs, which keeps the board small and the cost down. Second, a **hardware anti-aliasing filter** ahead of the ADC, so high-frequency noise is removed *before* sampling rather than trying to clean it up in software afterward. Getting the analog front end right is unglamorous work, but everything downstream inherits its quality — a noisy signal here means a model that learns noise later.

## 2. The real-time firmware pipeline

The firmware is bare-metal C, and it has a hard constraint: everything for one sample cycle must complete inside a **10 ms real-time window** to sustain 100 Hz across all channels.

The data path looks like this:

```text
ADC ──(DMA circular buffer)──> FIR digital filter ──> pressure normalization ──> feature vector
```

A few choices carry this stage:

- **DMA into a circular buffer.** The ADC feeds samples directly into memory via DMA, so the CPU is not babysitting every conversion. This frees the processor to do real work and keeps the sampling rock-steady.
- **An FIR digital filter** smooths each channel further, on top of the hardware anti-aliasing. FIR was the right choice for its stable, predictable phase behavior — important when you are about to measure *timing* features like heel strike and toe-off.
- **Pressure normalization** compensates for the per-sensor variation FSRs are notorious for, so a reading means the same thing across the array.

Doing all of this deterministically inside 10 ms — with no dynamic allocation and no surprises — is the difference between a system that works on the bench and one that works for an hour straight without drifting.

## 3. Feature extraction: turning pressure into biomechanics

Raw pressure values are not what a model should learn from. The firmware converts them into biomechanically meaningful features:

- **Center of Pressure (CoP)** — the X/Y trajectory of the pressure centroid as weight shifts through a step. This single curve says a lot about how someone walks.
- **Total load distribution** across the foot.
- **Medial/lateral symmetry index** — how balanced pressure is side to side.
- **Anterior/posterior weight ratio** — front-to-back balance.
- **Gait phase segmentation** — detecting heel strike, midstance, and toe-off from the pressure pattern.

Computing these on-device, in real time, means the model receives a compact, informative feature vector instead of a flood of raw samples. It also means the system is doing genuine signal processing, not just shipping numbers off to be figured out elsewhere.

## 4. The hard part: building my own dataset

Here is where the project stopped being a firmware exercise and became something harder.

A gait classifier is only as good as the data it learns from, and there was no ready-made dataset that matched my hardware, my sensor layout, and my feature set. So I built one. Using the Smart Foot hardware itself, I **recorded and labeled over 1,500 gait samples across 50 subjects**.

Three things about that dataset are worth calling out, because they are what separate a toy result from a defensible one:

- **50 subjects, not a handful.** A model trained on three people's walking will happily "work" — and then fall apart on the fourth person. Fifty subjects gives the model enough variety to learn what is common to a gait pattern rather than what is unique to one individual.
- **The atypical-gait class came from individuals with real, previously diagnosed gait conditions**, not from healthy volunteers pretending to limp. Simulated abnormal gait is a common shortcut, and it produces a model that recognizes *acting*, not the real thing. Using genuinely affected gait makes the "at-risk" class mean something.
- **A subject-independent split.** This is the detail I am proudest of. The test set contains people the model *never saw during training* — I held out whole subjects, not random samples. The tempting alternative (splitting samples randomly) lets the model quietly memorize individuals and report a beautiful, meaningless accuracy. Subject-independent evaluation is harder and the honest way to measure whether the model generalizes to a new person.

Collecting this data was slow, repetitive, logistically fiddly work — the opposite of glamorous. But it is also the part almost no one bothers to do, and it is the reason the results mean anything.

> **A note on the data:** Because this involved real people, including individuals with diagnosed conditions, the dataset was handled with care for privacy and used strictly for this research prototype. It is not a validated medical dataset, and Smart Foot is a research system, not a diagnostic device.

## 5. The model: a neural network that fits on a microcontroller

The classifier is a small neural network, **quantized to INT8** and deployed with **TensorFlow Lite Micro** so it runs directly on the microcontroller. It sorts gait into three classes — Normal, Postural Imbalance, and an at-risk gait indicator — and returns a result in **under 50 ms**.

Quantization is what makes this possible. A full floating-point model would not fit the memory or the compute budget of an embedded target; converting weights and activations to 8-bit integers shrinks the model and speeds up inference dramatically, at a small and manageable cost in accuracy. On a held-out set of **subjects the model had never seen**, it reached over **91% classification accuracy** — a number I trust precisely *because* of how the split was done.

Running inference on-device, rather than streaming raw data to the cloud, means the system is self-contained, low-latency, and private by design — the pressure data never has to leave the device to get a result.

## 6. Closing the loop: BLE and the companion dashboard

Finally, the system talks to the outside world. A **custom BLE 5.0 GATT profile** streams center-of-pressure trajectories and pressure heatmaps at around 2 KB/s to a companion application, over an encrypted, bonded connection. The dashboard visualizes live pressure heatmaps, CoP overlays, and symmetry indices, and generates readable gait and pressure summaries.

Designing a custom GATT profile — rather than shoving data through a generic serial-over-BLE service — keeps the wireless link efficient and structured, which matters when you are streaming continuous data on a power budget.

## What this project actually demonstrates

Smart Foot is, on the surface, a gait classifier. Underneath, it is proof of something more useful to a hardware team: the ability to take a connected-device idea through **every** layer it needs to become real — a custom analog front end, a deterministic real-time firmware pipeline, on-device signal processing and ML, wireless streaming, and an application to make sense of it all. And critically, the discipline to build and evaluate a dataset *honestly*, so the numbers survive scrutiny instead of collapsing under the first hard question.

That end-to-end ownership — and the willingness to do the slow, unglamorous parts properly — is what turns a promising prototype into a product you can actually trust.

---

### About the author

**Muhammad Shafqat Ashraf** is an Embedded, DSP & Firmware Systems Engineer specializing in ARM Cortex-M platforms, real-time firmware, on-device machine learning, and secure connectivity. He builds connected and low-power embedded products end to end — from custom hardware bring-up to shipped firmware.

If you are building a sensor-driven or ML-on-the-edge product and want someone who can own the full stack from analog front end to trained model, I'd be glad to talk.

- **Portfolio:** [shafqat-ashraf.vercel.app](https://shafqat-ashraf.vercel.app)
- **LinkedIn:** [linkedin.com/in/muhammad-shafqat-ashraf](https://linkedin.com/in/muhammad-shafqat-ashraf/)
