let net = require("net"),
  kadPTPpacket = require("./kadPTPmessage"),
  ITPpacket = require("./ITPResponse"),
  KADSeachPacket = require('./kadPTPSeachRequestPacket'),
  singleton = require("./Singleton");

const path = require('path');
const fs = require('fs');

let myReceivingPort = null;
let mySendingPort = null;

let clientRequestingImage = null;

var nickNames = {},
  clientIP = {},
  startTimestamp = {};

let peersList = [];

// list to record the IDs of its local images
let localKeysList = [];

module.exports = {
  handleClientJoining: function (sock) {
    // accept anyways in this assignment
    handleClient(sock);

  },
  handleCommunications: function (clientSocket, clientName) {
    communicate(clientSocket, clientName);
  },
  handleImageRequest: function (sock) {
    assignClientName(sock, nickNames);
    console.log(
      "\n" +
      nickNames[sock.id] +
      " is connected at timestamp: " +
      startTimestamp[sock.id]
    );

    sock.on("data", function (requestPacket) {
      handleImageRequests(requestPacket, sock); //read client requests and respond
    });

    sock.on("close", function () {
      handleClientLeaving(sock);
    });
  },
  // function to get the name of a file in the folder 
  populateLocalKeysList: function () {
    const directoryPath = path.join(__dirname);

    let imagesInDirectory = [];

    //passsing directoryPath and callback function
    fs.readdir(directoryPath, function (err, files) {
      //handling error
      if (err) {
        return console.log('Unable to scan directory: ' + err);
      }
      //listing all files using forEach
      files.forEach(function (file) {
        // Checking to see if the file has the extension of an image
        if (file.includes('.gif') || file.includes('.jpeg') || file.includes('.jpg')) {
          imagesInDirectory.push(file);
        }
      });

      imagesInDirectory.forEach((fileName) => {
        let temp = {
          imageName: fileName,
          imageID: singleton.getKeyID(fileName)
        };
        localKeysList.push(temp);
      })
    });
  }
};

function handleClient(sock) {
  let kadPacket = null;
  let KADSearchPktReceived = null;
  let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;

  // initialize client DHT table
  let joiningPeerID = singleton.getPeerID(sock.remoteAddress, sock.remotePort)
  let joiningPeer = {
    peerName: "",
    peerIP: sock.remoteAddress,
    peerPort: sock.remotePort,
    peerID: joiningPeerID
  };

  // Triggered only when the client is sending kadPTP message
  sock.on('data', (message) => {
    msgType = parseBitPacket(message, 4, 8);
    if (msgType != 3) {
      kadPacket = parseJoinRequestMessage(message);
    }
    // Message received is a KAD Search Packet 
    else {
      KADSearchPktReceived = message;
      kadPacket = parseKADSeachRequestMessage(message);
    }
  });

  sock.on('end', () => {
    // client edded the connection
    if (kadPacket) {
      // Here, the msgType cannot be 1. It can be 2 or greater
      if (kadPacket.msgType == 2) {
        console.log("Received Hello Message from " + kadPacket.senderName);

        if (kadPacket.peersList.length > 0) {
          let output = "  along with DHT: ";
          // now we can assign the peer name
          joiningPeer.peerName = kadPacket.senderName;
          for (var i = 0; i < kadPacket.peersList.length; i++) {
            output +=
              "[" +
              kadPacket.peersList[i].peerIP + ":" +
              kadPacket.peersList[i].peerPort + ", " +
              kadPacket.peersList[i].peerID +
              "]\n                  ";
          }
          console.log(output);
        }

        // add the sender into the table only if it is not exist or set the name of the exisiting one
        let exist = singleton.getDHTtable().table.find(e => e.node.peerPort == joiningPeer.peerPort);
        if (exist) {
          exist.node.peerName = joiningPeer.peerName;
        } else {
          pushBucket(singleton.getDHTtable(), joiningPeer);
        }

        // Now update the DHT table
        updateDHTtable(kadPacket.peersList);
      }
      // KAD Search Packet
      else if (kadPacket.msgType == 3) {
        let found = false;
        // check in this peer's list of keys for the image
        localKeysList.forEach((key) => {
          if (key.imageName == kadPacket.imageFullName) {
            found = true;
          }
        });

        // if the image was found in this peer, form an ITPResponse packet with the image
        // make the message type of 4 for "Found to Originator" and send to originating peer specified in KAD search packet
        if (found) {
          // read the image file data
          let imageData = fs.readFileSync(imageFullName);

          ITPpacket.init(
            version,
            4, // response type of "Found to Originator"
            singleton.getSequenceNumber(), // sequence number
            singleton.getTimestamp(), // timestamp
            imageData, // image data
          );

          // open a socket connection to the originating peer's port and ip specified in the packet and send the image
          let originatingPeerSock = new net.Socket;
          originatingPeerSock.connect({
            port: kadPacket.originatingPort,
            host: kadPacket.originatingIP,
            localPort: singleton.getPeerSocket()
          },
            () => {
              originatingPeerSock.write(ITPpacket.getBytePacket());
              setTimeout(() => {
                originatingPeerSock.end();
                originatingPeerSock.destroy();
              }, 500)
            }
          );
          sock.end();
        }
        // search the KAD peer network 
        else {
          let closestPeer = sendSearchToClosestPeer(singleton.getKeyID(kadPacket.imageFullName), singleton.getDHTtable());
          let sendToPeerSock = new net.Socket;
          sendToPeerSock.connect({
            port: closestPeer.peerPort,
            host: closestPeer.peerIP,
            localPort: singleton.getPeerSocket()
          },
            () => {
              // send the closest peer the original KAD Search packet we received
              sendToPeerSock.write(KADSearchPktReceived);
              setTimeout(() => {
                sendToPeerSock.end();
                sendToPeerSock.destroy();
              }, 500)
            }
          );
        }

      }
    } else {
      // This was a bootstrap request
      console.log("Connected from peer " + joiningPeerAddress + "\n");
      // add the requester info into server DHT table
      pushBucket(singleton.getDHTtable(), joiningPeer);
    }
  });

  if (kadPacket == null) {
    // This is a bootstrap request
    // send acknowledgment to the client
    kadPTPpacket.init(7, 1, singleton.getDHTtable());
    sock.write(kadPTPpacket.getPacket());
    sock.end();
  }
}

function communicate(clientSocket, clientName) {
  let senderPeerID = singleton.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort)

  clientSocket.on('data', (message) => {
    let kadPacket = parseJoinRequestMessage(message);

    let senderPeerName = kadPacket.senderName;
    let senderPeer = {
      peerName: senderPeerName,
      peerIP: clientSocket.remoteAddress,
      peerPort: clientSocket.remotePort,
      peerID: senderPeerID
    };

    if (kadPacket.msgType == 1) {
      // This message comes from the server
      console.log(
        "Connected to " +
        senderPeerName +
        ":" +
        clientSocket.remotePort +
        " at timestamp: " +
        singleton.getTimestamp() + "\n"
      );

      // Now run as a server
      myReceivingPort = clientSocket.localPort;
      let localPeerID = singleton.getPeerID(clientSocket.localAddress, myReceivingPort);
      let serverPeer = net.createServer();
      serverPeer.listen(myReceivingPort, clientSocket.localAddress);
      console.log(
        "This peer address is " +
        clientSocket.localAddress +
        ":" +
        myReceivingPort +
        " located at " +
        clientName +
        " [" + localPeerID + "]\n"
      );

      // Wait for other peers to connect
      serverPeer.on("connection", function (sock) {
        // again we will accept all connections in this assignment
        handleClient(sock);
      });

      console.log("Received Welcome message from " + senderPeerName) + "\n";
      if (kadPacket.peersList.length > 0) {
        let output = "  along with DHT: ";
        for (var i = 0; i < kadPacket.peersList.length; i++) {
          output +=
            "[" +
            kadPacket.peersList[i].peerIP + ":" +
            kadPacket.peersList[i].peerPort + ", " +
            kadPacket.peersList[i].peerID +
            "]\n                  ";
        }
        console.log(output);
      } else {
        console.log("  along with DHT: []\n");
      }

      // add the bootstrap node into the DHT table but only if it is not exist already
      let exist = singleton.getDHTtable().table.find(e => e.node.peerPort == clientSocket.remotePort);
      if (!exist) {
        pushBucket(singleton.getDHTtable(), senderPeer);
      } else {
        console.log(senderPeer.peerPort + " is exist already")
      }

      updateDHTtable(kadPacket.peersList)

    } else {
      // Later we will consider other message types.
      console.log("The message type " + kadPacket.msgType + " is not supported")
    }
  });

  clientSocket.on("end", () => {
    // disconnected from server
    sendHello(singleton.getDHTtable())
  })
}

function handleImageRequests(data, sock) {
  // check to see if its an ITPRequest or an ITPResponse packet
  let potentialResponseType = parseBitPacket(data, 4, 8);
  // since the ITPRequest bits 4 to 12 would be filled with 0s (Reserved), if the value != 0, its a Response packet
  if (potentialResponseType != 0) {
    // Edit the response type, timestamp and sequence number fields of the ITPResponse packet received 
    storeBitPacket(data, 1, 4, 8); // Changing the reponse type from "Found to Originator" to "Found to Client"
    storeBitPacket(data, singleton.getSequenceNumber(), 12, 20);
    storeBitPacket(data, singleton.getTimestamp(), 32, 32);

    // write back to the client that requested the image
    clientRequestingImage.write(data);
    clientRequestingImage.end();
  }
  // Otherwise its an ITPRequest packet for an image
  else {
    console.log("\nITP packet received from: " + sock.remoteAddress + ":" + sock.remotePort);
    printPacketBit(data);

    let version = parseBitPacket(data, 0, 4);
    let requestType = parseBitPacket(data, 24, 8);
    let requestName = {
      0: "Query",
      1: "Found to Client",
      4: "Found to Originator",
    };
    let imageExtension = {
      1: "BMP",
      2: "JPEG",
      3: "GIF",
      4: "PNG",
      5: "TIFF",
      15: "RAW",
    };
    let timeStamp = parseBitPacket(data, 32, 32);
    let imageType = parseBitPacket(data, 64, 4);
    let imageTypeName = imageExtension[imageType];
    let imageNameSize = parseBitPacket(data, 68, 28);
    let imageName = bytesToString(data.slice(12, 13 + imageNameSize));

    let imageFullName = imageName + "." + imageTypeName.toLowerCase();

    console.log(
      "\n" +
      nickNames[sock.id] +
      " requests:" +
      "\n    --ITP version: " +
      version +
      "\n    --Timestamp: " +
      timeStamp +
      "\n    --Request type: " +
      requestName[requestType] +
      "\n    --Image file extension(s): " +
      imageTypeName +
      "\n    --Image file name: " +
      imageName +
      "\n"
    );

    let found = false;
    // check in this peer's list of keys for the image
    localKeysList.forEach((key) => {
      if (key.imageName == imageFullName) {
        found = true;
      }
    });

    // if the image was found in this peer, form an ITPResponse packet with the image
    if (found) {
      // read the image file data
      let imageData = fs.readFileSync(imageFullName);

      ITPpacket.init(
        version,
        1, // response type of "Found to Client"
        singleton.getSequenceNumber(), // sequence number
        singleton.getTimestamp(), // timestamp
        imageData, // image data
      );
      // open a socket connection to the port and ip specified in the packet and send the image
      sock.write(ITPpacket.getBytePacket());
      setTimeout(() => {
        sock.end();
        sock.destroy();
      }, 500);
    }
    // search the KAD peer network 
    else {
      // store the socket in a reference so we can use it when the reponse packet is returned by the peer that has the image
      clientRequestingImage = sock;

      // initialize a KAD search packet for the image
      KADSeachPacket.init(
        version,
        3,
        imageType,
        imageName
      );
      
      let closestPeer = sendSearchToClosestPeer(singleton.getKeyID(imageFullName), singleton.getDHTtable());
      
      let sendToPeerSock = new net.Socket;
      sendToPeerSock.connect({
        port: closestPeer.peerPort,
        host: closestPeer.peerIP,
        localPort: singleton.getPeerSocket()
      },
        () => {
          sendToPeerSock.write(KADSeachPacket.getBytePacket());
          setTimeout(() => {
            sendToPeerSock.end();
            sendToPeerSock.destroy();
          }, 500)
        }
      );
    }
  }
}

function handleClientLeaving(sock) {
  console.log(nickNames[sock.id] + " closed the connection");
  
}

function updateDHTtable(list) {
  // Refresh the local k-buckets using the transmitted list of peers. 

  refreshBucket(singleton.getDHTtable(), list)
  console.log("Refresh k-Bucket operation is performed.\n");
  let DHTtable = singleton.getDHTtable();

  if (DHTtable.table.length > 0) {
    let output = "My DHT: ";
    for (var i = 0; i < DHTtable.table.length; i++) {
      output +=
        "[" +
        DHTtable.table[i].node.peerIP + ":" +
        DHTtable.table[i].node.peerPort + ", " +
        DHTtable.table[i].node.peerID +
        "]\n        ";
    }
    console.log(output);
  }

}

function parseJoinRequestMessage(message) {
  let kadPacket = {}
  peersList = [];
  let bitMarker = 0;
  kadPacket.version = parseBitPacket(message, 0, 4);
  bitMarker += 4;
  kadPacket.msgType = parseBitPacket(message, 4, 8);
  bitMarker += 8;
  let numberOfPeers = parseBitPacket(message, 12, 8);
  bitMarker += 8;
  let SenderNameSize = parseBitPacket(message, 20, 12);
  bitMarker += 12;
  kadPacket.senderName = bytes2string(message.slice(4, SenderNameSize + 4));
  bitMarker += SenderNameSize * 8;

  if (numberOfPeers > 0) {
    for (var i = 0; i < numberOfPeers; i++) {
      let firstOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let secondOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let thirdOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let forthOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let port = parseBitPacket(message, bitMarker, 16);
      bitMarker += 16;
      let IP = firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;
      let peerID = singleton.getPeerID(IP, port);
      let aPeer = {
        peerIP: IP,
        peerPort: port,
        peerID: peerID
      };
      peersList.push(aPeer);
    }
  }
  kadPacket.peersList = peersList;
  return kadPacket;
}

function refreshBucket(T, peersList) {
  peersList.forEach(P => {
    pushBucket(T, P);
  });
}

// pushBucket method stores the peer’s information (IP address, port number, and peer ID) 
// into the appropriate k-bucket of the DHTtable. 
function pushBucket(T, P) {
  // First make sure that the given peer is not the loacl peer itself, then  
  // determine the prefix i which is the maximum number of the leftmost bits shared between  
  // peerID the owner of the DHTtable and the given peer ID. 

  if (T.owner.peerID != P.peerID) {
    let localID = singleton.Hex2Bin(T.owner.peerID);
    let receiverID = singleton.Hex2Bin(P.peerID);
    // Count how many bits match
    let i = 0;
    for (i = 0; i < localID.length; i++) {
      if (localID[i] != receiverID[i])
        break;
    }

    let k_bucket = {
      prefix: i,
      node: P
    };

    let exist = T.table.find(e => e.prefix === i);
    if (exist) {
      // insert the closest 
      if (singleton.XORing(localID, singleton.Hex2Bin(k_bucket.node.peerID)) <
        singleton.XORing(localID, singleton.Hex2Bin(exist.node.peerID))) {
        // remove the existing one
        for (var k = 0; k < T.table.length; k++) {
          if (T.table[k].node.peerID == exist.node.peerID) {
            console.log("** The peer " + exist.node.peerID + " is removed and\n** The peer " +
              k_bucket.node.peerID + " is added instead")
            T.table.splice(k, 1);
            break;
          }
        }
        // add the new one    
        T.table.push(k_bucket);
      }
    } else {
      T.table.push(k_bucket);
    }
  }

  // set the singleton's DHT table to "save" the edits we just made
  singleton.setDHTtable(T);

}
// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time. 
function sendHello(T) {
  let i = 0;
  // we use echoPeer method to do recursive method calls
  echoPeer(T, i);
}

// This method call itself (T.table.length) number of times,
// each time it sends hello messags to all peers in T
function echoPeer(T, i) {
  setTimeout(() => {
    let sock = new net.Socket();
    sock.connect(
      {
        port: T.table[i].node.peerPort,
        host: T.table[i].node.peerIP,
        localPort: T.owner.peerPort
      },
      () => {
        // send Hello packet 
        kadPTPpacket.init(7, 2, T);
        sock.write(kadPTPpacket.getPacket());
        setTimeout(() => {
          sock.end();
          sock.destroy();
        }, 500)
      }
    );
    sock.on('close', () => {
      i++;
      if (i < T.table.length) {
        echoPeer(T, i)
      }
    })
    if (i == T.table.length - 1) {
      console.log("Hello packet has been sent.\n");
    }
  }, 500)
}

function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    if (array[i] > 0) result += String.fromCharCode(array[i]);
  }
  return result;
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}

function bytesToString(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

// Prints the entire packet in bits format
function printPacketBit(packet) {
  var bitString = "";

  for (var i = 0; i < packet.length; i++) {
    // To add leading zeros
    var b = "00000000" + packet[i].toString(2);
    // To print 4 bytes per line
    if (i > 0 && i % 4 == 0) bitString += "\n";
    bitString += " " + b.substr(b.length - 8);
  }
  console.log(bitString);
}

function sendSearchToClosestPeer(keyID, DHTtable) {
  let keyIDBinary = singleton.Hex2Bin(keyID);
  let thisPeerIDBinary = singleton.Hex2Bin(singleton.getPeerID(singleton.getIP(), singleton.getPeerSocket()));
  // Count how many bits match
  let i = 0;
  for (i = 0; i < thisPeerIDBinary.length; i++) {
    if (thisPeerIDBinary[i] != keyIDBinary[i])
      break;
  }
  
  for(let peer of DHTtable.table){
    // return the peer with the same longest common prefix as the keyID with this peer
    if (peer.prefix == i) {
      return peer.node;
    }
  };
}

function parseKADSeachRequestMessage(message) {
  let kadPacket = {}
  peersList = [];
  let bitMarker = 0;
  kadPacket.version = parseBitPacket(message, 0, 4);
  bitMarker += 4;
  kadPacket.msgType = parseBitPacket(message, 4, 8);
  bitMarker += 16;
  let SenderNameSize = parseBitPacket(message, 20, 12);
  bitMarker += 12;
  kadPacket.senderName = bytes2string(message.slice(4, SenderNameSize + 4));
  bitMarker += SenderNameSize * 8;

  let firstOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  let secondOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  let thirdOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  let forthOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  kadPacket.originatingPort = parseBitPacket(message, bitMarker, 16);
  bitMarker += 16;
  kadPacket.originatingIP = firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;

  kadPacket.imageType = parseBitPacket(message, bitMarker, 4);
  bitMarker += 4;
  let ImageSize = parseBitPacket(message, bitMarker, 28);
  bitMarker += 28;
  kadPacket.imageName = bytes2string(message.slice(bitMarker, ImageSize));
  let imageExtension = {
    1: "BMP",
    2: "JPEG",
    3: "GIF",
    4: "PNG",
    5: "TIFF",
    15: "RAW",
  };
  kadPacket.imageFullName = `${kadPacket.imageName}.${imageExtension[kadPacket.imageType]}`;

  return kadPacket;
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

function assignClientName(sock, nickNames) {
  sock.id = sock.remoteAddress + ":" + sock.remotePort;
  startTimestamp[sock.id] = singleton.getTimestamp();
  var name = "Client-" + startTimestamp[sock.id];
  nickNames[sock.id] = name;
  clientIP[sock.id] = sock.remoteAddress;
}