import { Transport } from "@open-rpc/client-js/build/transports/Transport";
import { JSONRPCRequestData, getBatchRequests, getNotifications } from "@open-rpc/client-js/build/Request";
import { JSONRPCError } from "@open-rpc/client-js";
import { ERR_UNKNOWN } from "@open-rpc/client-js/build/Error";

const EXTENSION_ID = 'nonfpcflonapegmnfeafnddgdniflbnk';

class MetaMaskTransport extends Transport {

  private extensionPort?: chrome.runtime.Port;

  private onMessageListener(msg: any) {
    const { data } = msg;
    this.transportRequestManager.resolveResponse(data);
  }

  public async connect(): Promise<boolean> {
    this.extensionPort = this.extensionPort || chrome.runtime.connect(EXTENSION_ID);
    this.extensionPort.onDisconnect.addListener(() => {
      this.extensionPort?.onMessage.removeListener(this.onMessageListener);
      this.extensionPort = undefined;
    });
    this.extensionPort.onMessage.addListener(this.onMessageListener);
    return true;
  }

  public async sendData(data: JSONRPCRequestData, timeout: number | undefined = 5000): Promise<any> {
    let prom = this.transportRequestManager.addRequest(data, timeout);
    const notifications = getNotifications(data);
    try {
      this.extensionPort?.postMessage({
        type: 'caip-x',
        data,
      });
      this.transportRequestManager.settlePendingRequest(notifications);
    } catch (err) {
      const jsonError = new JSONRPCError((err as any).message, ERR_UNKNOWN, err);

      this.transportRequestManager.settlePendingRequest(notifications, jsonError);
      this.transportRequestManager.settlePendingRequest(getBatchRequests(data), jsonError);

      prom = Promise.reject(jsonError);
    }

    return prom;
  }

  public close(): void {
    this.extensionPort?.onMessage.removeListener(this.onMessageListener);
  }
}

export default MetaMaskTransport;
