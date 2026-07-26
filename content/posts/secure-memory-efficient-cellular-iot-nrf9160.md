---
title: "Building Secure, Memory-Efficient Cellular IoT on Nordic Platforms"
date: 2026-07-26
excerpt: "A practical field guide to the three hard problems in cellular IoT firmware: fitting everything into the nRF9160's memory budget, authenticating the UART link between two microcontrollers, and integrating with the Golioth cloud."
tags: [embedded, nRF9160, Zephyr, IoT, firmware, security, Golioth]
relatedProject: "Smart IoT Monitoring System"
---

# Building Secure, Memory-Efficient Cellular IoT on Nordic Platforms

*A practical guide to nRF9160 memory optimization, secure inter-MCU UART authentication, and Golioth cloud integration.*

By **Muhammad Shafqat Ashraf** — Embedded, DSP & Firmware Systems Engineer

---

Cellular IoT products look simple from the outside: a device wakes up, reads a sensor or a credential, and reports to the cloud. Under the hood, the firmware engineer is fighting three battles at once — fitting a full networking stack into a few hundred kilobytes of RAM, keeping the links between components trustworthy, and moving data to and from the cloud reliably over an intermittent cellular connection.

This guide walks through how I approach each of those three problems on the Nordic ecosystem: the **nRF9160** cellular SiP, a companion **nRF52**-class controller, an **ESP32** edge node, and **Golioth** as the device-management cloud. The techniques are general-purpose; adapt the numbers to your own hardware budget.

## 1. Fitting the firmware into the nRF9160's memory budget

The nRF9160 gives the application core roughly **1 MB of flash and 256 KB of RAM** to work with. That sounds generous until the LTE-M/NB-IoT modem library, a TLS/DTLS stack, the Zephyr kernel, a networking subsystem, and your own application logic all start competing for the same space. Running out of RAM at link time is the single most common wall junior engineers hit on this platform. Here is the discipline I use to stay under budget.

### Measure before you cut

Never optimize blind. Zephyr ships build targets that break memory down symbol by symbol, so you know exactly where the bytes went before you touch anything:

```bash
west build -t ram_report      # RAM usage by symbol / area
west build -t rom_report      # flash usage by symbol / area

# For a visual, interactive breakdown:
puncover --build_dir build/
```

This tells you whether your problem is buffers, stacks, the crypto heap, or dead code you forgot to disable. Optimizing the wrong thing wastes days.

### Right-size stacks and the heap

Zephyr's default stack and heap sizes are deliberately conservative — generous enough to never crash in a demo, far larger than a tuned application needs. These Kconfig values are usually the fastest wins:

```ini
CONFIG_MAIN_STACK_SIZE=2048
CONFIG_SYSTEM_WORKQUEUE_STACK_SIZE=2048
CONFIG_HEAP_MEM_POOL_SIZE=8192

# Size per-thread stacks to their real high-water mark, not a guess:
CONFIG_THREAD_STACK_INFO=y      # enables stack usage analysis
CONFIG_INIT_STACKS=y
```

Enable stack analysis, run the device through its worst-case path, then read back the high-water mark and trim each stack to that plus a safety margin. Oversized stacks are pure waste — they reserve RAM that nothing ever uses.

### Disable what you are not using

Zephyr is modular, and a surprising amount of RAM disappears into subsystems that got pulled in by a default or a sample you started from. Audit your `prj.conf` and switch off anything the product does not need — shells, extra console backends, unused sensors, IPv6 if you are IPv4-only, filesystem layers, and so on. Every disabled subsystem returns both flash and RAM.

### Tame the logging subsystem

Logging is the quiet memory hog. Deferred logging allocates buffers; string literals live in flash; every log call adds code. In development, keep it. For a memory-constrained production build, minimize or strip it:

```ini
CONFIG_LOG=y
CONFIG_LOG_MODE_MINIMAL=y     # drops the deferred-logging buffers
CONFIG_LOG_DEFAULT_LEVEL=1    # errors only in production

# Or remove logging entirely from the release image:
# CONFIG_LOG=n
```

### Trim the TLS/crypto footprint

Secure cloud connectivity means DTLS, and the mbedTLS heap is often the largest single RAM consumer on the device. Two levers matter most: sizing the crypto heap to what your handshake actually needs, and cutting the cipher-suite list down to the one suite your cloud uses.

```ini
CONFIG_MBEDTLS_HEAP_SIZE=8192
# Enable only the cipher suite your backend negotiates —
# every extra suite is code and tables you will never run.
```

### Let the compiler help

- **Build for size:** `CONFIG_SIZE_OPTIMIZATIONS=y` (-Os).
- **Use the compact C library:** the nano/pico variant strips features you rarely need on an MCU.
- **Kill floating-point printf:** formatting floats drags in a large chunk of libc — avoid it in log strings.
- **Prefer static allocation:** statically sized buffers and pools are predictable and leak-proof; dynamic allocation on a constrained MCU invites fragmentation.

## 2. Securing the UART link between two microcontrollers

Multi-MCU designs are everywhere: one chip owns connectivity, another owns a peripheral or an edge function, and they talk over UART. The trap is treating that internal serial link as inherently trustworthy. It is not. If an attacker can reach the board, they can tap the line, inject frames, or replay a captured command. When the command in question does something consequential, the link needs authentication.

### Start with a threat model

Before writing a byte of protocol, name what you are defending against:

- **Spoofed commands** — a rogue device pretending to be the trusted controller.
- **Replay attacks** — a valid frame captured on the wire and re-sent later.
- **Tampering** — bytes flipped in transit to change a command's meaning.

A plain UART protocol defends against none of these. The following pattern defends against all three without heavyweight infrastructure.

### A challenge–response handshake with a shared secret

Both microcontrollers are provisioned with the same secret key at manufacture. Instead of ever sending that key over the wire, they prove knowledge of it. A typical exchange:

```text
Controller  --->  Node        : REQUEST + fresh nonce (random)
Node        --->  Controller   : HMAC(secret, nonce || command)
Controller  verifies the HMAC before acting on the command
```

The nonce is the key detail: because it is fresh and random every time, the same command produces a different authentication tag on every exchange. A captured frame is therefore useless if replayed — its nonce is stale. Pair the nonce with a monotonic sequence counter and you get strong replay protection.

### Integrity and framing

Wrap every message in a defined frame — start delimiter, length, payload, and a message authentication code (MAC) computed over the whole payload. The MAC gives you tamper detection for free: flip a bit in transit and the MAC no longer matches, so the receiver rejects the frame. If the payload itself is sensitive, encrypt it (AES) in addition to authenticating it; if it is not, authentication alone is usually enough.

### Implementation discipline

- **Store the shared secret in protected storage,** not in a plain header or anywhere it lands in a log.
- **Compare MACs in constant time** to avoid leaking information through timing.
- **Reject malformed or oversized frames early** — a robust parser is itself a security control.
- **Never log secrets or raw keys,** even at debug level; it is the most common accidental leak.

## 3. Getting the nRF9160 online with Golioth

Golioth is a device-management cloud built around the Zephyr firmware SDK, with first-tier support for the nRF9160. It handles the parts of cloud IoT that are tedious to build yourself — secure connectivity, device state, telemetry storage, remote commands, and over-the-air updates — so the firmware engineer can focus on the device.

### Secure provisioning with PSK over DTLS

Devices authenticate to Golioth using a pre-shared key (PSK) over a DTLS connection. Each device carries a PSK-ID and PSK, set once and stored on the device:

```bash
uart:~$ settings set golioth/psk-id <my-psk-id@my-project>
uart:~$ settings set golioth/psk    <my-psk>
uart:~$ kernel reboot cold
```

For production fleets, provision credentials at manufacture rather than by hand, and consider the nRF9160's on-chip Key Management Unit (KMU) so keys never sit in application-readable flash.

### State vs. telemetry: LightDB and LightDB Stream

Golioth splits device data into two services, and picking the right one keeps your data model clean:

- **LightDB (state)** — a real-time database that mirrors the device's current state, ideal for a digital twin: configuration, thresholds, last-known status.
- **LightDB Stream** — a time-series store for sensor readings and events you want to query historically.

On the device side, encode readings compactly (CBOR is common) and let the cloud expand them. Current Golioth projects route incoming data through **Pipelines** — a configurable layer that transforms and routes each message (for example, CBOR to JSON into LightDB Stream) which you can change from the console without reflashing firmware.

### Remote control and updates

Two features turn a reporting device into a manageable one. **Remote procedure calls (RPC)** let a backend or app trigger an action on the device on demand. **Over-the-air (OTA) firmware updates** let you ship fixes and features to a deployed fleet — which is exactly why you fought for that RAM headroom in Section 1; an OTA needs room to stage the incoming image.

### Closing the loop to a mobile app

The mobile or web app does not talk to the device directly — it talks to Golioth's cloud API (REST and WebSocket) and lets the platform handle the intermittent cellular link. The app reads device state and telemetry, and issues commands via RPC that Golioth delivers when the device next checks in. This decoupling is what makes the product feel responsive even when the device sleeps to save power.

## Bringing it together

These three problems reinforce one another. Aggressive memory discipline is what leaves room for a real TLS stack and OTA. A trustworthy internal UART link is what lets a small edge node safely drive a consequential action. And a proper cloud integration is what turns an isolated device into a manageable, updatable product. Getting all three right — on constrained hardware, under real power budgets — is the craft of cellular IoT firmware, and it is where most of the engineering risk in a connected product actually lives.

---

### About the author

**Muhammad Shafqat Ashraf** is an Embedded, DSP & Firmware Systems Engineer specializing in ARM Cortex-M platforms, Zephyr RTOS, secure firmware, and edge intelligence. He builds production-ready cellular and low-power IoT systems — from board bring-up and memory optimization to secure connectivity and cloud integration.

If you are wrestling with any of the problems in this guide — firmware that won't fit, a device that won't stay connected, or a product that needs to get from prototype to reliable deployment — I'd be glad to help.

- **Portfolio:** [shafqat-ashraf.vercel.app](https://shafqat-ashraf.vercel.app)
- **LinkedIn:** [linkedin.com/in/muhammad-shafqat-ashraf](https://linkedin.com/in/muhammad-shafqat-ashraf/)
