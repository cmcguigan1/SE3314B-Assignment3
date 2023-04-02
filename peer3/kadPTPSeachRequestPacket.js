const singleton = require('./Singleton');
let version, msgType, senderNameLength, senderName, originatingPeerIP, originatingPeerImagePort, imageExt, imageData;
let headerBuffer, senderNameBuffer, payloadBuffer;

module.exports = {
  init: function (ver, messageType, imageExt, imageName) {
    headerBuffer = new Buffer.alloc(4);
    version = ver;
    msgType = messageType;
    senderName = stringToBytes(singleton.getSenderName());
    senderNameLength = senderName.length;
    originatingPeerIP = singleton.getIP();
    originatingPeerImagePort = singleton.getImageSocket();
    imageData = stringToBytes(imageName);

    // Populating the fixed length buffer for the header
    storeBitPacket(headerBuffer, Number(version), 0, 4);
    storeBitPacket(headerBuffer, Number(msgType), 4, 8);
    storeBitPacket(headerBuffer, senderNameLength, 20, 12);

    // Creating a buffer the length of the sender name and populating the buffer
    let senderNameBuff = new Buffer.alloc(4);
    for (j = 0; j < senderName.length; j++) {
      senderNameBuff[j] = senderName[j];
    }

    // Creating a buffer for the originating peer's ip address and image port number
    let originatingPeerBuff = new Buffer.alloc(6);
    let splitIP = originatingPeerIP.split(".");
    for (let i = 0; i < splitIP.length; i++) {
      storeBitPacket(originatingPeerBuff, Number(splitIP[i]), i * 8, 8);
    }
    // storing the port number
    storeBitPacket(originatingPeerBuff, Number(originatingPeerImagePort), 32, 16);
 
    senderNameBuffer = Buffer.concat([senderNameBuff, originatingPeerBuff]);

    let payloadHeaderBuff = new Buffer.alloc(4);
    storeBitPacket(payloadHeaderBuff, imageExt, 0, 4);
    storeBitPacket(payloadHeaderBuff, imageData.length, 4, 28);

    let payloadBuff = new Buffer.alloc(imageData.length + 4);
    // Image data    
    for (j = 0; j < imageData.length; j++) {
      payloadBuff[j] = imageData[j];
    }

    payloadBuffer = Buffer.concat([payloadBuff, payloadBuff]);
  },
  //--------------------------
  //getBytePacket: returns the entire packet in bytes
  //--------------------------
  getBytePacket: function () {
    let combinedBufferArray;
    combinedBufferArray = [headerBuffer, senderNameBuffer, payloadBuffer];
    return Buffer.concat(combinedBufferArray);
  },
}

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


