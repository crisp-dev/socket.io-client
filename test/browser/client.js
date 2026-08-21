import socketIo, * as client from "../../build/esm/index.js";

window.socketIoTest = {
  ...client,
  default: socketIo,
};
