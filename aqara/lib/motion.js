const Subdevice = require('./subdevice')
/**
 * WQ/ep
 * 1 门磁状态
 */
const WQ = {
  "state":1
};
class Motion extends Subdevice {
  constructor (opts) {
    super({ sid: opts.sid,sendData:opts.sendData, type: 'motion' })

    this._open = null
      this.timeHandle = {};
  }

  _handleState (state,cmd) {
    super._handleState(state,cmd);



   if(state.status === 'motion'){
       if(this.timeHandle[WQ.state]){
           clearTimeout(this.timeHandle[WQ.state])
       }
       this.wqs[WQ.state] = true;
       this.emit('wqChanged',WQ.state,cmd);
       this.timeHandle[WQ.state] = setTimeout(function(){
           this.wqs[WQ.state]= false;
           this.emit('wqChanged',WQ.state,cmd);
       }.bind(this),3000);
   }
  }

  isOpen () {
    return this._open
  }
}

module.exports = Motion;
