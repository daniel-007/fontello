'use strict';


var UNICODE_CODES_MIN = 0x0;
var UNICODE_CODES_MAX = 0x10FFFF;

var UNICODE_SURROGATE_BLOCK_MIN = 0xD800;
var UNICODE_SURROGATE_BLOCK_MAX = 0xDFFF;

var UNICODE_PRIVATE_USE_AREA_MIN = 0xE800;
var UNICODE_PRIVATE_USE_AREA_MAX = 0xF8FF;

var ASCII_PRINTABLE_MIN = 0x21;
var ASCII_PRINTABLE_MAX = 0x7E;

// Restricted codepoints.
// http://www.w3.org/TR/xml11/#charsets
var RESTRICTED_CODES = {};

[ 0x0,     0x1,     0x2,     0x3,     0x4,     0x5,      0x6,     0x7
, 0x8,     0xB,     0xC,     0xE,     0xF,     0x10,     0x11,    0x12
, 0x13,    0x14,    0x15,    0x16,    0x17,    0x18,     0x19,    0x1A
, 0x1B,    0x1C,    0x1D,    0x1E,    0x1F,    0x7F,     0x80,    0x81
, 0x82,    0x83,    0x84,    0x86,    0x87,    0x88,     0x89,    0x8A
, 0x8B,    0x8C,    0x8D,    0x8E,    0x8F,    0x90,     0x91,    0x92
, 0x93,    0x94,    0x95,    0x96,    0x97,    0x98,     0x99,    0x9A
, 0x9B,    0x9C,    0x9D,    0x9E,    0x9F,    0xFDD0,   0xFDD1,  0xFDD2
, 0xFDD3,  0xFDD4,  0xFDD5,  0xFDD6,  0xFDD7,  0xFDD8,   0xFDD9,  0xFDDA
, 0xFDDB,  0xFDDC,  0xFDDD,  0xFDDE,  0xFDDF,  0xFFFE,   0xFFFF,  0x1FFFE
, 0x1FFFF, 0x2FFFE, 0x2FFFF, 0x3FFFE, 0x3FFFF, 0x4FFFE,  0x4FFFF, 0x5FFFE
, 0x5FFFF, 0x6FFFE, 0x6FFFF, 0x7FFFE, 0x7FFFF, 0x8FFFE,  0x8FFFF, 0x9FFFE
, 0x9FFFF, 0xAFFFE, 0xAFFFF, 0xBFFFE, 0xBFFFF, 0xCFFFE,  0xCFFFF, 0xDFFFE
, 0xDFFFF, 0xEFFFE, 0xEFFFF, 0xFFFFE, 0xFFFFF, 0x10FFFE, 0x10FFFF
].forEach(function (code) { RESTRICTED_CODES[code] = true; });


// Hash table used to keep control on automatic codepoint assignment when user
// selects/deselects some glyphs. Keys are codepoints. Values are instances of
// GlyphModel. See app.js for details.
var usedCodes = {};


// Returns true if code is valid and not used.
//
function checkCode(code) {
  return code >= UNICODE_CODES_MIN &&
         code <= UNICODE_CODES_MAX &&
         (code < UNICODE_SURROGATE_BLOCK_MIN || code > UNICODE_SURROGATE_BLOCK_MAX) &&
         !RESTRICTED_CODES[code] &&
         !usedCodes[code];
}


// Returns first available and valid code in the range.
//
function findCode(min, max) {
  for (var code = min; code <= max; code += 1) {
    if (checkCode(code)) {
      return code;
    }
  }
  return -1;
}


// Returns first available and valid code in the Unicode Private Use Area.
//
function findPrivateUseArea() {
  var code = findCode(UNICODE_PRIVATE_USE_AREA_MIN, UNICODE_PRIVATE_USE_AREA_MAX);

  if (-1 !== code) {
    return code;
  } else { // Should never happen.
    throw new Error('Free codepoints in the Private Use Area are run out.');
  }
}


// Returns first available and valid printable ASCII code.
// Fallbacks to findPrivateUseArea()
//
function findAscii(preferedCode) {
  if (preferedCode &&
      checkCode(preferedCode) &&
      preferedCode >= ASCII_PRINTABLE_MIN &&
      preferedCode <= ASCII_PRINTABLE_MAX) {
    return preferedCode;
  }

  var code = findCode(ASCII_PRINTABLE_MIN, ASCII_PRINTABLE_MAX);

  return (-1 !== code) ? code : findPrivateUseArea();
}


// Returns the given code if it is available and valid.
// Fallbacks to findPrivateUseArea()
//
function findUnicode(code) {
  return checkCode(code) ? code : findPrivateUseArea();
}


// Sets a new glyph code using the specified encoding (N.app.encoding).
//
function allocateCode(glyph, encoding) {
  var newCode;

  switch (encoding) {
  case 'pua':
    newCode = findPrivateUseArea();
    break;

  case 'ascii':
    newCode = findAscii(glyph.code());
    break;

  case 'unicode':
    newCode = findUnicode(glyph.originalCode);
    break;

  default:
    throw new Error('Unknown glyph enumerator: ' + encoding);
  }

  glyph.code(newCode);

  // Ensure code is marks as 'used' for the glyph. It's needed in cases when
  // default glyph code is equal to an allocated one - so automatic allocation
  // does not work.
  usedCodes[newCode] = glyph;
}


function observe(glyph) {
  var previousCode = glyph.code();

  // Keep track on previous code value.
  glyph.code.subscribe(function (code) {
    previousCode = code;

    if (usedCodes[code] === this) {
      usedCodes[code] = null;
    }
  }, glyph, 'beforeChange');

  // When user set the glyph code to a used one - swap them.
  glyph.code.subscribe(function (code) {
    if (this.selected()) {
      if (usedCodes[code]) {
        usedCodes[code].code(previousCode);
      }
      usedCodes[code] = this;
    }
  }, glyph);

  // When user selects/deselects the glyph - allocate/free a code.
  glyph.selected.subscribe(function (selected) {
    if (selected) {
      allocateCode(this, N.app.encoding());
    } else {
      usedCodes[this.code()] = null;
    }
  }, glyph);
}


exports.observe = observe;