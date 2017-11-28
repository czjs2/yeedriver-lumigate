const dgram = require('dgram')
const os = require('os')
const events = require('events');
const _ = require('lodash');
const consts = require('yeedriver-base/consts')
const {MULTICAST_ADDRESS, DISCOVERY_PORT, SERVER_PORT} = require('./constants');
const Gateway = require('./lib/gateway');
const Q = require('q');

class Aqara extends events.EventEmitter {
    constructor(master) {
        super();
        this.master = master;
        this._gateways = {};

        this.enumDeviceMute = 20;
        this._serverSocket = dgram.createSocket('udp4');
        this._serverSocket.on('listening', () => {
            const networkIfaces = os.networkInterfaces();
            for (const ifaceName in networkIfaces) {
                const networkIface = networkIfaces[ifaceName];

                for (const connection of networkIface) {
                    if (connection.family === 'IPv4') {
                        this._serverSocket.addMembership(MULTICAST_ADDRESS, connection.address)
                    }
                }
            }

            this._triggerWhois();
        });

        setInterval(function () {
            if (this.enumDeviceMute > 0) {
                this.enumDeviceMute--;
            }
        }.bind(this), 1000);
        this._serverSocket.on('message', this._handleMessage.bind(this));

        this._serverSocket.bind(SERVER_PORT, '0.0.0.0')
    }

    _triggerWhois() {
        console.log('discover gateway:');
        const payload = '{"cmd": "whois"}';
        this._serverSocket.send(payload, 0, payload.length, DISCOVERY_PORT, MULTICAST_ADDRESS)
    }

    get gateways() {
        return this._gateways;
    }

    _handleMessage(msg,rInfo) {
        const parsed = JSON.parse(msg.toString());

        //console.log('get message:', JSON.stringify(parsed));
        let handled = false;

        switch (parsed.cmd) {
            case 'heartbeat':
                if (parsed.model==='gateway'){
                    if (!this._gateways[parsed.sid]) {
                        handled = true;
                        this._triggerWhois();
                    }
                    else {
                        this._gateways[parsed.sid]._inSids = (this.master.rawOptions.sids && this.master.rawOptions.sids[parsed.sid])?true:false;
                    }
                }

                break;
            case 'iam':
                handled = true;
                if (this._gateways[parsed.sid]){
                    this._gateways[parsed.sid]._inSids = (this.master.rawOptions.sids && this.master.rawOptions.sids[parsed.sid]);
                    break;
                }


                const gateway = new Gateway({
                    inSids:(this.master.rawOptions.sids && this.master.rawOptions.sids[parsed.sid])?true:false,
                    ip: parsed.ip,
                    sid: parsed.sid,
                    password:(this.master.rawOptions.tokens && this.master.rawOptions.tokens[parsed.sid]),
                    sendUnicast: (payload) => this._serverSocket.send(payload, 0, payload.length, SERVER_PORT, parsed.ip),
                    evtMaster: this.master
                });
                gateway.on('fireEvent', function (data) {
                    this.emit('fireEvent', data);
                }.bind(this));
                gateway.on('writeError', function (devId) {
                    this.emit('writeError', devId)
                }.bind(this));
             /*   gateway.on('offline', () => {
                    gateway.removeAllListeners('offline');
                    gateway.removeAllListeners('updateWQState');
                    //delete this._gateways[parsed.sid]
                    this._triggerWhois();
                });*/
                this._gateways[parsed.sid] = gateway;
                this.emit('gateway', gateway);

                break;
        }

        if (!handled) { // propagate to gateways
            let gateway = _.find(this._gateways,(gw)=>{
                return gw._ip === rInfo.address;
            });

            if(gateway){
                handled = gateway._handleMessage(parsed);
            }
        }

        if (!handled)
            console.log(`not handled: ${JSON.stringify(parsed)}`)
    }

    getDevice(devId) {
        let device;
        _.each(this._gateways, function (gw, key) {
            if(!gw){
                console.error(`no gw found: ${key}`);
                console.log(_.keys(this._gateways));
            }else{
                let subDev = gw.getDevice(devId);
                if (subDev) {
                    device = subDev;
                    return true;
                }
            }

        });
        return device;
    }

    WriteWQ(wqMap, value, devId) {
        let subDev = this.getDevice(devId);
        if (subDev) {
            for (let i = wqMap.start; i <= wqMap.end; i++) {
                console.log(`write WQ:${i}`)
                this.emit('updateWQState', {devId: devId, wq: i, state: consts.WRITE_STATE.BUSY, param: 2});//最多4秒
                subDev.writeWQ(i, value[i]);
            }
        } else {

            console.error(`device ${devId} not found!`);
            this.EnumDevices();
        }
    }

    setTokens(tokens) {
        _.each(this._gateways, (gateway, gwId) => {
            gateway.setPassword(tokens[gwId]);
        });
    }

    ReadWQ(wqMap, devId) {
        let subDev = this.getDevice(devId);
        let result = [];
        if (subDev) {
            for (let i = wqMap.start; i <= wqMap.end; i++) {
                result.push(subDev.readWQ(i));
            }
        }
        return result;
    }

    releaseGWs(){
        _.each(this._gateways,(gateway)=>{
            gateway.release();
        });
        this._gateways = {};
    }
    //重新查询所有的设备
    EnumDevices() {
        if (this.enumDeviceMute === 0) {
            this.enumDeviceMute = 20;

            this._triggerWhois();

            setTimeout(() => {
                _.each(this._gateways, function (gateway) {
                    gateway.enumDevices();
                })
            }, 2000)


        }


    }

    /**
     * 获取当前所有的设备信息
     */
    getDevicesList(getAll) {
        let result = {};
        _.each(this.gateways, function (gateway, gwId) {
            if(gateway._inSids || getAll){
                result[gwId] = {uniqueId: 'gateway'};
                _.each(gateway.subdevices, function (device, deviceID) {
                    result[deviceID] = {uniqueId: device.getType()};
                });
            }

        });
        return result;
    }

    removeDevice(deviceId,isGateway){
        if(isGateway){
            if(this.gateways[deviceId]){
                this.gateways[deviceId].release();
                delete this.gateways[deviceId];
            }
            else {
                return Q.reject('no gateway');
            }

        }
        else {
            _.each(this.gateways, function (gateway, gwId) {
                gateway.writeValueToDev("remove_device",`"${deviceId}"`);
            });
        }
        return Q.resolve({});

    }

    joinPermission(permission,gateway){
        let tarGateway ;
        if(gateway){
            tarGateway = gateway;
        }
        else{
            tarGateway = _.keys(this.gateways)[0];
        }
        if(this.gateways[tarGateway]){
            this.gateways[tarGateway].writeValueToDev("join_permission",`"${permission}"`);
            return Q.resolve({});
        }
        else {
            return Q.reject('no gateway');
        }

    }
}

module.exports = Aqara;
