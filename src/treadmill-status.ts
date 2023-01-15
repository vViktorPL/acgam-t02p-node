export type TreadmillStatus
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
