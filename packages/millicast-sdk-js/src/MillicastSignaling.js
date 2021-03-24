import Logger from "./Logger";
const logger = Logger.get("MillicastSignaling");
import EventEmitter from "events";
import TransactionManager from "transaction-manager";

/**
 * @class MillicastSignaling
 */

export default class MillicastSignaling extends EventEmitter {
  constructor(options) {
    super();
    this.ws = null;
    this.tm = null;
    this.streamName = null;
    this.wsUrl = options && options.url ? options.url : "ws://localhost:8080/";
  }

  /**
   * Establish MillicastStream Connection.
   * @param {String} url - WebSocket url.
   * @return {Promise}
   */

  async connect(url) {
    logger.info("Connecting to Millicast");
    if (!!this.tm && !!this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info("Connection successful");
      logger.debug("WebSocket value: ", this.ws);
      this.emit("connection.success", { ws: this.ws, tm: this.tm });
      return Promise.resolve(this.ws);
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.tm = new TransactionManager(this.ws);
      this.ws.onopen = () => {
        logger.info("WebSocket opened");
        if (this.ws.readyState !== WebSocket.OPEN) {
          let error = { state: this.ws.readyState };
          logger.error("WebSocket not connected: ", error);
          this.emit("connection.error", error);
          return reject(error);
        }
        this.tm.on("event", (evt) => {
          this.emit("event", evt);
        });
        logger.info("Connection successful");
        logger.debug("WebSocket value: ", this.ws);
        this.emit("connection.success", {});
        resolve(this.ws);
      };
      this.ws.onclose = () => {
        this.ws = null;
        this.tm = null;
        logger.info("WebSocket closed");
        logger.debug("WebSocket value: ", this.ws);
        this.emit("connection.close", {});
      };
    });
  }

  /**
   * Destroy MillicastStream Connection.
   *
   */
  async close() {
    logger.info("Closing WebSocket");
    if (this.ws) this.ws.close();
  }

  /**
   * Subscribe MillicastStream.
   * @param {String} sdp - The sdp.
   * @param {String} streamId  - The streamId.'
   * @return {String} sdp - Mangled SDP
   */
  async subscribe(sdp, streamId) {
    logger.info("Subscribing, streamId value: ", streamId);
    logger.debug("SDP: ", sdp);

    let data = {
      sdp,
      streamId,
    };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
      await this.connect(this.wsUrl);

    try {
      logger.info("Sending view command");
      const result = await this.tm.cmd("view", data);
      logger.info("Command sent");
      logger.debug("Command result: ", result);
      return result.sdp;
    } catch (e) {
      logger.error("Error sending view command, error: ", e);
      throw e;
    }
  }

  /**
   * Publish MillicastStream.
   * @param {String} sdp - The local sdp.
   */
  async publish(sdp) {
    logger.info("Publishing, streamName value: ", this.streamName);
    logger.debug("SDP: ", sdp);

    let data = {
      name: this.streamName,
      sdp,
      codec: "h264",
    };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
      await this.connect(this.wsUrl);

    try {
      logger.info("Sending publish command");
      const result = await this.tm.cmd("publish", data);
      logger.info("Command sent");
      logger.debug("Command result: ", result);
      return result.sdp;
    } catch (e) {
      logger.error("Error sending publish command, error: ", e);
      throw e;
    }
  }
}
