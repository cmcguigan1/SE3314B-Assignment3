let net = require("net"),
  singleton = require("./Singleton"),
  handler = require("./PeersHandler");
let os = require("os");

singleton.init();


// get current folder name
let path = __dirname.split("\\");
let myName = path[path.length - 1];

let ifaces = os.networkInterfaces();
let HOST = "";

// get a random port > 3000 and < 5000 for the image socket
let imageSocketPort = singleton.getImageSocketPort();
// fixed value for the peer socket
let peerSocketPort = 2001;

// get the loaclhost ip address
Object.keys(ifaces).forEach(function (ifname) {
  ifaces[ifname].forEach(function (iface) {
    if ("IPv4" == iface.family && iface.internal !== false) {
      HOST = iface.address;
    }
  });
});



let KADserverID = singleton.getPeerID(HOST, peerSocketPort);

// peer format
// {
//   peerName: peer's name (folder name)  
//   peerIP: peer ip address,
//   peerPort: peer port number,
//   peerID: the node DHT ID
// }
//
// DHT format
// {
//   owner: a peer
//   table: array of k_buckets  
// }
//
// k-bucket format (it is one object because k=1 in this assignment)
// {
//  prefix: i, (the maximum number of the leftmost bits shared between the owner of the DHTtable and the node below) 
//  node: peer
// }

if (process.argv.length > 2) {
  // call as node KADpeer [-p <serverIP>:<port>]

  // This peer runs as a client
  // this needs more work to validate the command line arguments
  let firstFlag = process.argv[2]; // should be -p
  let hostserverIPandPort = process.argv[3].split(":");
  let knownHOST = hostserverIPandPort[0];
  let knownPORT = hostserverIPandPort[1];

  // connect to the known peer address (any peer act as a server)
  let peerSocket = new net.Socket();
  peerSocket.connect({ port: knownPORT, host: knownHOST, localPort: peerSocketPort }, () => {
    // initialize client DHT table
    let clientID = singleton.getPeerID(peerSocket.localAddress, peerSocketPort)
    let clientPeer = {
      peerName: myName, // client name
      peerIP: peerSocket.localAddress,
      peerPort: peerSocketPort,
      peerID: clientID
    };

    let clientDHTtable = {
      owner: clientPeer,
      table: []
    }

    handler.handleCommunications(peerSocket, myName /*client name*/, clientDHTtable);
  });

} else {
  // call as node peer (no arguments)
  // run as a server
  let KADServerSocket = net.createServer();
  KADServerSocket.listen(peerSocketPort, HOST);
  console.log(
    "This peer address is " + HOST + ":" + peerSocketPort + " located at " + myName /*server name*/ + " [" + KADserverID + "]"
  );

  // initialize server DHT table
  let serverPeer = {
    peerName: myName,
    peerIP: HOST,
    peerPort: peerSocketPort,
    peerID: KADserverID
  };

  let serverDHTtable = {
    owner: serverPeer,
    table: []
  }

  KADServerSocket.on("connection", function (sock) {
    // received connection request
    handler.handleClientJoining(sock, serverDHTtable);
  });

}
