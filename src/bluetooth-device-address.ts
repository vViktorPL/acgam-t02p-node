export class BluetoothDeviceAddress {
  private constructor(private value: string) {}

  static fromString(value: string) {
    const addressHexCodes = value.split(':');

    if (
      addressHexCodes.length !== 6 ||
      addressHexCodes.some(hexCode => hexCode.length !== 2 || isNaN(parseInt(hexCode, 16)))
    ) {
      throw new TypeError(`Expected Bluetooth device id string like: "FF:FF:FF:FF:FF:FF", got: ${JSON.stringify(value)}`);
    }

    return new BluetoothDeviceAddress(value);
  }

  toString() {
    return this.value;
  }
}