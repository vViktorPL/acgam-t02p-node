import {ChildProcessWithoutNullStreams, exec, spawn} from 'child_process';
import { BluetoothDeviceAddress } from './bluetooth-device-address';
import * as readline from "readline";
import {TreadmillStatus} from "./treadmill-status";
import {parseTreadmillNotificationData} from "./treadmill-notification-data-parser";

export type TreadmillStatusNotificationListener = (status: TreadmillStatus) => void;

const TREADMILL_DATA_NOTIFICATION_LINE_DATA_PREFIX = 'Notification handle = 0x0008 value: ';

export class TreadmillConnection {
  private address: BluetoothDeviceAddress | null = null;
  private connected: boolean = false;
  private gattProcess: ChildProcessWithoutNullStreams;
  private gattProcessLineReader: readline.Interface;
  private notificationListeners: TreadmillStatusNotificationListener[] = [];
  private lastNotificationTogglePromise: Promise<boolean> = Promise.resolve(false);
  private notificationLineListener: ((lineData: string) => void) | null = null;

  private constructor() {
    this.gattProcess = spawn('gatttool', ['-I', '--listen']);
    this.gattProcessLineReader = readline.createInterface({
      input: this.gattProcess.stdout,
    });

  }

  private connect(deviceAddress: BluetoothDeviceAddress): Promise<this> {
    this.address = deviceAddress;

    return new Promise(resolve => {
      const connectionSuccessfulLineListener = (lineData: string) => {
        if (lineData.includes('Connection successful')) {
          this.connected = true;
          this.gattProcessLineReader.off('line', connectionSuccessfulLineListener);
          resolve(this);
        }
      };

      this.gattProcessLineReader.on('line', connectionSuccessfulLineListener);

      this.gattProcess.stdin.cork();
      this.gattProcess.stdin.write(`connect ${this.address!.toString()}\n`);
      this.gattProcess.stdin.uncork();
    });
  }

  addStatusNotificationEventListener(listener: TreadmillStatusNotificationListener) {
    if (this.notificationLineListener === null) {
      this.notificationLineListener = (lineData: string) => {
        const lineDataUnformatted = lineData.substring(3);

        if (!lineDataUnformatted.startsWith(TREADMILL_DATA_NOTIFICATION_LINE_DATA_PREFIX)) {
          return;
        }

        const msgHexCodes = lineDataUnformatted.substring(TREADMILL_DATA_NOTIFICATION_LINE_DATA_PREFIX.length).split(' ');
        msgHexCodes.pop();

        const msgBuffer = Buffer.from(msgHexCodes.map(byte => parseInt(byte, 16)));
        const parsedStatus = parseTreadmillNotificationData(msgBuffer);

        if (!parsedStatus) {
          return;
        }

        this.notificationListeners.forEach(
          listener => listener(parsedStatus)
        );
      };
      this.notificationLineListener = this.notificationLineListener.bind(this);
    }

    this.notificationListeners.push(listener);

    if (this.notificationListeners.length === 1) {
      this.gattProcessLineReader.on('line', this.notificationLineListener);
      void this.toggleNotifications(true);
    }
  }

  removeStatusNotificationEventListener(listener: TreadmillStatusNotificationListener) {
    const listenerIndex = this.notificationListeners.indexOf(listener);

    if (listenerIndex === -1) {
      return;
    }

    this.notificationListeners.splice(listenerIndex, 1);

    if (this.notificationListeners.length === 0) {
      if (this.notificationLineListener) {
        this.gattProcessLineReader.off('line', this.notificationLineListener);
      }
      void this.toggleNotifications(false);
    }
  }

  disconnect() {
    if (this.connected) {
      this.gattProcess.stdin.cork();
      this.gattProcess.stdin.write('disconnect\n');
      this.gattProcess.stdin.uncork();
    }

    this.connected = false;
    this.gattProcessLineReader.close();
    this.gattProcess.stdin.destroy();
    this.gattProcess.stderr.destroy();
    this.gattProcess.kill('SIGKILL');
  }

  private async toggleNotifications(state: boolean) {
    if (!this.connected) {
      throw new Error('Cannot subscribe to treadmill data notifications when disconnected');
    }

    const lastState = await this.lastNotificationTogglePromise;

    if (lastState === state) {
      return lastState;
    }

    this.lastNotificationTogglePromise = new Promise(resolve => {
      const successfulSubscriptionLineListener = (lineData: string) => {
        if (lineData === 'Characteristic value was written successfully') {
          this.gattProcessLineReader.off('line', successfulSubscriptionLineListener);
          resolve(state);
        }
      };

      this.gattProcessLineReader.on('line', successfulSubscriptionLineListener);

      this.gattProcess.stdin.cork();
      this.gattProcess.stdin.write(`char-write-req 9 ${state ? '01' : '00'}\n`);
      this.gattProcess.stdin.uncork();
    });

    return this.lastNotificationTogglePromise;
  }

  static forAddress(deviceAddress: BluetoothDeviceAddress): Promise<TreadmillConnection> {
    return (new TreadmillConnection()).connect(deviceAddress);
  }
}