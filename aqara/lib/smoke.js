const Subdevice = require('./subdevice');

const WQ = {
    "state":1,
    "density":2,
    "fault":5000
};
class Smoke extends Subdevice {
    constructor (opts) {
        super({ sid: opts.sid,sendData:opts.sendData, type: 'smoke' })
    }

    _handleState (state,cmd) {
        super._handleState(state,cmd);

        if(state.alarm){
            let alarm = parseInt(state.alarm);

            switch(alarm){
                case 0:
                    this.wqs[WQ.state] = 0;
                    this.wqs[WQ.fault] = 0;
                    this.emit('wqChanged',WQ.state,cmd);
                    this.emit('wqChanged',WQ.fault,cmd);
                    break;
                case 1:
                case 2:
                    this.wqs[WQ.state] = alarm;
                    this.emit('wqChanged',WQ.state,cmd);
                    break;
                case 64:
                case 32768:
                    this.wqs[WQ.fault] = alarm;
                    this.emit('wqChanged',WQ.fault,cmd);
                    break;
                default:
                    break;

            }
        }
        if(state.density){
            this.wqs[WQ.density] = parseInt(state.density);
            this.emit('wqChanged',WQ.density,cmd);
        }

    }

}

module.exports = Smoke;