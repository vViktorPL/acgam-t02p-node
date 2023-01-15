import { TreadmillStatus } from "./treadmill-status";

export function parseTreadmillNotificationData(data: Buffer): TreadmillStatus | undefined {
  switch (data[1]) {
    case 0x04:
      return {
        status: 'STANDBY',
      };

    case 0x05:
      return {
        status: 'STOPPED',
      };

    case 0x10:
      if (data[3] === 0x08) {
        return {
          status: 'WAKING_UP',
        };
      }

      if (data[3] === 0x05) {
        return {
          status: 'STOPPED',
        };
      }

      if (data[3] === 0x01 && data.length === 6) {
        return {
          status: 'PRESTART',
        };
      }

      if (data[3] === 0x01) {
        return {
          status: 'STARTING',
          countdown: data[10],
        };
      }


      if (data[3] === 0x02 || data[3] === 0x04) {
        return {
          status: data[3] === 2 ? 'RUNNING' : 'STOPPING',
          elapsedSeconds: data[8] * 3600 + data[9] * 60 + data[10],
          distanceInMeters: (data[11] * 256 + data[12]) * 10,
          speed: {
            currentKmh: data[5] / 10,
            targetKmh: data[4] / 10,
          },
        };
      }
  }

}