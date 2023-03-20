import {createBluetooth} from 'node-ble';

import { BluetoothDeviceAddress } from './bluetooth-device-address';
import {TreadmillStatus} from "./treadmill-status";
import {parseTreadmillNotificationData} from "./treadmill-notification-data-parser";
import * as NodeBle from "node-ble";

export type TreadmillStatusNotificationListener = (status: TreadmillStatus) => void;


const ACGAM_NOTIFICATION_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const ACGAM_NOTIFICATION_CHARACTERISTICS_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';

export class TreadmillConnection {
  private bluetoothInstance: ReturnType<typeof createBluetooth>;
  private bluetoothAdapter: NodeBle.Adapter | null = null;
  private treadmillDevice: NodeBle.Device | null = null;
  private dataCharacteristic: NodeBle.GattCharacteristic | null = null;

  private address: BluetoothDeviceAddress | null = null;
  private notificationListeners: TreadmillStatusNotificationListener[] = [];

  private connectionPromise: Promise<void> | null = null;

  private constructor() {
    this.bluetoothInstance = createBluetooth();
  }

  private async connect(deviceAddress: BluetoothDeviceAddress): Promise<this> {
    if (!this.bluetoothAdapter) {
      this.bluetoothAdapter = await this.bluetoothInstance.bluetooth.defaultAdapter();
    }

    const adapter = this.bluetoothAdapter;

    if (!await adapter.isDiscovering()) {
      await adapter.startDiscovery();
    }

    this.address = deviceAddress;

    this.treadmillDevice = await adapter.waitDevice(deviceAddress.toString());
    this.treadmillDevice.on('disconnect', () => {
      if (this.dataCharacteristic) {
        this.dataCharacteristic.stopNotifications();
        this.dataCharacteristic.removeAllListeners('valuechanged');
        this.dataCharacteristic = null;
      }

      this.notificationListeners.forEach(
        listener => listener({
          status: 'DISCONNECTED',
        })
      );

      if (!this.connectionPromise) {
        this.connectionPromise = this.tryConnecting();
      }
    })
    this.treadmillDevice.on('connect', async () => {
      if (this.connectionPromise) {
        this.connectionPromise = null;
      }

      const gattServer = await this.treadmillDevice!.gatt();
      const service = await gattServer.getPrimaryService(ACGAM_NOTIFICATION_SERVICE_UUID);
      this.dataCharacteristic = await service.getCharacteristic(ACGAM_NOTIFICATION_CHARACTERISTICS_UUID);
      this.dataCharacteristic.on('valuechanged', buffer => {
        const parsedStatus = parseTreadmillNotificationData(buffer);

        if (!parsedStatus) {
          return;
        }

        this.notificationListeners.forEach(
          listener => listener(parsedStatus)
        );
      });

      if (this.notificationListeners.length > 0) {
        await this.dataCharacteristic.startNotifications();
      }
    })

    await this.tryConnecting();

    return this;
  }

  private async tryConnecting() {
    if (!this.treadmillDevice) {
      throw Error('No device to connect');
    }

    let connected = false;
    while (!connected) {
      connected = await this.treadmillDevice.connect()
        .then(() => true)
        .catch(async () => {
          await this.treadmillDevice?.disconnect();
          return false;
        });
    }
  }


  addStatusNotificationEventListener(listener: TreadmillStatusNotificationListener) {
    this.notificationListeners.push(listener);

    if (this.dataCharacteristic && this.notificationListeners.length === 1) {
      void this.dataCharacteristic.startNotifications();
    }
  }

  removeStatusNotificationEventListener(listener: TreadmillStatusNotificationListener) {
    const listenerIndex = this.notificationListeners.indexOf(listener);

    if (listenerIndex === -1) {
      return;
    }

    this.notificationListeners.splice(listenerIndex, 1);

    if (this.notificationListeners.length === 0 && this.dataCharacteristic) {
      void this.dataCharacteristic.stopNotifications();
    }
  }

  async disconnect() {
    if (this.treadmillDevice) {
      await this.treadmillDevice.disconnect();
      this.treadmillDevice = null;
    }
  }

  destroy() {
    this.bluetoothInstance.destroy();
  }

  static forAddress(deviceAddress: BluetoothDeviceAddress): Promise<TreadmillConnection> {
    const connection = new TreadmillConnection();
    return connection.connect(deviceAddress).catch(error => {
      connection.destroy();

      throw error;
    });
  }
}