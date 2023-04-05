
let sequenceNumber;
let timerInterval = 10;
let timer;
let imageSocketNumber;
let peerSocketNumber;
let IP;
let senderName;
let DHTtable;

function timerRun() {
    timer ++;
    if (timer == 4294967295) {
        timer = Math.floor(1000 * Math.random()); // reset timer to be within 32 bit size
    }
}

module.exports = {
    init: function() {
        timer = Math.floor(1000 * Math.random()); /* any random number */
        setInterval(timerRun, timerInterval);
        sequenceNumber = Math.floor(1000 * Math.random()); /* any random number */
    },

    //--------------------------
    //getSequenceNumber: return the current sequence number + 1
    //--------------------------
    getSequenceNumber: function() {
        sequenceNumber ++;
        return sequenceNumber;
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        return timer;
    },

    //--------------------------
    //get random port > 3000 and < 5000
    //--------------------------
    getImageSocketPort: function() {
        let socket = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
        this.setImageSocket(socket);
        return socket;
    },

    //--------------------------
    //getPeerID: takes the IP and port number and returns 20 bytes Hex number
    //--------------------------
    getPeerID: function (IP, port) {
        var crypto = require('crypto')
        var sha1 = crypto.createHash('sha1')
        sha1.update(IP + ':' + port)
        return sha1.digest('hex')
    },

    //--------------------------
    //getKeyID: takes the key name and returns 20 bytes Hex number
    //--------------------------
    getKeyID: function (key) {
        var crypto = require('crypto')
        var sha1 = crypto.createHash('sha1')
        sha1.update(key)
        return sha1.digest('hex')
    },

    //--------------------------
    //Hex2Bin: convert Hex string into binary string
    //--------------------------
    Hex2Bin: function (hex) {
        var bin = ""
        hex.split("").forEach(str => {
            bin += parseInt(str, 16).toString(2).padStart(8, '0')
        })
        return bin
    },

    //--------------------------
    //XORing: finds the XOR of the two Binary Strings with the same size
    //--------------------------
    XORing: function (a, b){
    let ans = "";
        for (let i = 0; i < a.length ; i++)
        {
            // If the Character matches
            if (a[i] == b[i])
                ans += "0";
            else
                ans += "1";
        }
        return ans;
    },

    setImageSocket: function (port){
        imageSocketNumber = port;
    },
    setPeerSocket: function (senderName){
        if(senderName == "peer1"){
            peerSocketNumber = 2001;
        }
        else if(senderName == "peer2"){
            peerSocketNumber = 2055;
        }
        else if(senderName == "peer3"){
            peerSocketNumber = 2077;
        }
        else if(senderName == "peer4"){
            peerSocketNumber = 2044;
        }
        else{
            peerSocketNumber = 2005;
        }
    },
    setIP: function (ip){
        IP = ip;
    },
    setSenderName: function (sender){
        senderName = sender;
    },
    setDHTtable: function(table){
        DHTtable = table;
    },

    getImageSocket: function (){
        return imageSocketNumber;
    },
    getPeerSocket: function (){
        return peerSocketNumber;
    },
    getIP: function (){
        return IP;
    },
    getSenderName: function (){
        return senderName;
    },
    getDHTtable: function (){
        return DHTtable;
    },
};