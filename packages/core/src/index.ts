export {
  CATEGORIES,
  classify,
  formatCodePoint,
  type CharCategory,
  type CodePointRange,
} from "./registry.js";
export { detect, hasInvisible, type Finding } from "./detect.js";
export {
  encode,
  encodeTags,
  encodeVariationSelectors,
  encodeZeroWidth,
  EncodeError,
  SCHEMES,
  type EncodeScheme,
} from "./encode.js";
export {
  decode,
  decodeAll,
  decodeTags,
  decodeVariationSelectors,
  decodeZeroWidth,
  type DecodeResult,
  type SchemeDecodeResult,
} from "./decode.js";
