
const Subdevice = require('./subdevice');
const _ = require('lodash');

const CURTAIN_WQ ={
    'open':1,
    'close':2,
    'stop':3,
    'curtain_level':4
}

class curtain extends Subdevice {
    constructor(opts) {
        super({queryData:opts.queryData,sid: opts.sid, sendData: opts.sendData, triggerWq:opts.triggerWq,type: 'curtain'});

        this.timeHandle = [];


    }

    _handleState(state, cmd) {
        super._handleState(state);


        if (state.curtain_level) {
            this.wqs[CURTAIN_WQ.curtain_level] = (parseInt(state.curtain_level) * 100 / 255).toFixed(0);
            this.emit('wqChanged', CURTAIN_WQ.curtain_level, cmd);

        }

        // if (state.status) {
        //     this.wqs[CURTAIN_WQ.status] = state.status;
        //     this.emit('wqChanged', CURTAIN_WQ.curtain_level, cmd);
        // }

    }

    writeWQ(wq, value) {
        let writeValue = "";
        let cmd = "status";
        switch (parseInt(wq)){
            case CURTAIN_WQ.open:
                this.wqs_target[wq] = "open";
                break;
            case CURTAIN_WQ.close:
                this.wqs_target[wq] = "close";
                break;
            case CURTAIN_WQ.stop:
                this.wqs_target[wq] = "stop";
                break;
            case CURTAIN_WQ.curtain_level:
                cmd = "curtain_level";
                this.wqs_target[wq] = value;
                break;
        }

        this.sendDataToDev(cmd, `"${this.wqs_target[wq]}"`, {sid: this.getSid(), model: 'curtain'});
        if(cmd == "status"){
            this.triggerWq(this._sid, wq, 'write_ack');
        }

    }

    readWQ(wq) {
        return this.wqs[wq] === undefined ? true : this.wqs[wq];
    }

    goToConfirm(wq){
        return false;
    }
}
module.exports = curtain;
