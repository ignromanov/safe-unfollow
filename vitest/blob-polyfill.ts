/**
 * jsdom's Blob is missing the byte-producing half of the platform's Blob.
 *
 * jsdom 26.1 implements `slice` and nothing else — no `arrayBuffer`, no `text`,
 * no `stream`. Browsers have had all three since 2020 (Chrome 76, Firefox 69,
 * Safari 14), and this project's floor is already later than that: the ZIP
 * reader needs `DecompressionStream('deflate-raw')`, which is Safari 16.4.
 *
 * So this is a gap in the test environment, not in the product. Without it the
 * ZIP reader cannot read anything under Vitest, while working in every browser
 * we support. `FileReader` is jsdom's only route from a Blob to its bytes, which
 * is also why the random-access test instruments `readAsArrayBuffer`: it is the
 * one place bytes actually change hands here.
 */
export function setupBlobPolyfill() {
  if (typeof Blob === 'undefined') return;

  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }

  if (!Blob.prototype.stream) {
    Blob.prototype.stream = function (this: Blob): ReadableStream<Uint8Array> {
      const bytes = this.arrayBuffer();
      return new ReadableStream({
        async start(controller) {
          controller.enqueue(new Uint8Array(await bytes));
          controller.close();
        },
      });
    };
  }

  if (!Blob.prototype.text) {
    Blob.prototype.text = async function (this: Blob): Promise<string> {
      return new TextDecoder().decode(new Uint8Array(await this.arrayBuffer()));
    };
  }
}
