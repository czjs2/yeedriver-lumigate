
const Subdevice = require('./subdevice');

const CURTAIN_WQ ={
    'open':1,
    'close':2,
    'stop':3,
    'curtain_level':4
}

class curtain extends Subdevice {
    constructor(opts) {
        super({sid: opts.sid, sendData: opts.sendData, type: 'curtain'});

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
                writeValue = "open";
                break;
            case CURTAIN_WQ.close:
                writeValue = "close";
                break;
            case CURTAIN_WQ.stop:
                writeValue = "stop";
                break;
            case CURTAIN_WQ.curtain_level:
                cmd = "curtain_level";
                writeValue = value;
                break;
        }

        return this.sendDataToDev(cmd, `"${writeValue}"`, {sid: this.getSid(), model: 'curtain'});

    }

    goToConfirm(wq){
        this.queryData(this._sid);

        if (parseInt(wq)<3){
            return true;
        }

    }
}
module.exports = curtain;
