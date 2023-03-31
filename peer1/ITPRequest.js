//size of the request packet:
let HEADER_SIZE = 12;

//Fields that compose the ITP header
let version, requestType, currentTime;

module.exports = {
  requestHeader: "", //Bitstream of the request packet
  payloadSize: 0, //size of the ITP payload

  payload: "", //Bitstream of the ITP payload

  init: function (ver, fullImageName, timeStamp) {
    //fill by default packet fields:
    version = ver;
    requestType = 0;
    currentTime =  timeStamp;
    //build the header bistream:
    //--------------------------
    this.rquestHeader = new Buffer.alloc(HEADER_SIZE);

    //fill the header array of bytes
    // v
    storeBitPacket(this.rquestHeader, version * 1, 0, 4);
    // Request type
    storeBitPacket(this.rquestHeader, requestType, 24, 8);
    // timeStamp

    storeBitPacket(this.rquestHeader, currentTime, 32, 32);
    let imageExtension = {
      BMP: 1,
      JPEG: 2,
      GIF: 3,
      PNG: 4,
      TIFF: 5,
      RAW: 15,
    };
    imageName = stringToBytes(fullImageName.split(".")[0]);
    imageType = imageExtension[fullImageName.split(".")[1].toUpperCase()];
    // IT
    storeBitPacket(this.rquestHeader, imageType, 64, 4);
    //image name length
    storeBitPacket(this.rquestHeader, imageName.length, 68, 28);

    this.payloadSize = imageName.length;
    this.payload = new Buffer.alloc(this.payloadSize );

    // image file name
    for (j = 0; j < imageName.length; j++) {
      this.payload[j] = imageName[j];
    }


  },

  //--------------------------
  //getBytePacket: returns the entire packet in bytes
  //--------------------------
  getBytePacket: function () {
    let packet = new Buffer.alloc(this.payload.length + HEADER_SIZE);
    //construct the packet = header + payload
    for (var Hi = 0; Hi < HEADER_SIZE; Hi++) packet[Hi] = this.rquestHeader[Hi];
    for (var Pi = 0; Pi < this.payload.length; Pi++)
      packet[Pi + HEADER_SIZE] = this.payload[Pi];

    return packet;
  },
};

function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
}
