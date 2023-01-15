# acgam-t02p

[ACGAM T02P Treadmill](https://www.acgam.com/collections/treadmill/products/acgam-2-in-1-folding-treadmill-with-remote-control-and-led-display-installation-free-under-desk-electric-treadmill) BLE communication library for Node.js.

It can be easily used for instance on Raspberry Pi 4 with Raspbian OS
to grab live stats from your treadmill.

## Prerequisites

This library wraps `gatttool` CLI tool which is often included
in [BlueZ](http://www.bluez.org/) Linux packages, so it requires
`gatttool` to be available in your OS. For instance

## Installation

```bash
npm i acgam-t02p
```

## Example usage

```typescript
import { BluetoothDeviceAddress, TreadmillConnection, TreadmillStatus } from 'acgam-t02p';

const DEVICE_ADDRESS = 'FF:FF:FF:FF:FF:FF'; // TODO: Change with your real device address

(async () => {
  const connection = await TreadmillConnection.forAddress(
    BluetoothDeviceAddress.fromString(DEVICE_ADDRESS)
  );

  connection.addStatusNotificationEventListener(handleNotification);
})();

function handleNotification(status: TreadmillStatus) {
  console.log(status);
}
```

## API

### TreadmillConnection

This is main class that enables you to maintain a connection and communication
with treadmill device.

### BluetoothDeviceAddress

Helper value object that stores valid bluetooth device address.

### TreadmillStatus

It's data structure that will come into your treadmill status notification listener:

```
type TreadmillStatus
  = { status: 'STANDBY' }
  | { status: 'STOPPED' }
  | { status: 'WAKING_UP' }
  | { status: 'PRESTART' }
  | { status: 'STARTING'; countdown: number }
  | {
      status: 'RUNNING' | 'STOPPING';
      elapsedSeconds: number;
      distanceInMeters: number;
      speed: {
        currentKmh: number;
        targetKmh: number;
      };
    };
```

Example status data with its interpretation:

| JSON                                                                                                            | Interpretation       |
|-----------------------------------------------------------------------------------------------------------------|----------------------|
| `{ "status": "STOPPED" }`                                                                                        | Treadmill is stopped |
| `{ "status": "STARTING", "countdown": 5 }`                                                                        | Treadmill is going to start and it's 5 seconds until start. |
| `{ "status": "RUNNING", "elapsedSeconds": 330, "distanceInMeters": 1500, "speed": { "currentKmh": 11.5, "targetKmh": 8 } }` | Treadmill is running. Elapsed time: 5 minutes 30 seconds. Distance: 1.5km. Current speed 11.5 km/h and it's slowly descending to target 8 km/h.|
