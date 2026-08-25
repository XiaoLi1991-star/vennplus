declare module 'utif' {
  interface TiffIfd {
    [tag: string]: unknown;
  }

  interface UtifApi {
    encodeImage(
      rgba: ArrayBuffer,
      width: number,
      height: number,
      metadata?: TiffIfd,
    ): ArrayBuffer;
    decode(buffer: ArrayBuffer): TiffIfd[];
  }

  const UTIF: UtifApi;
  export default UTIF;
}
