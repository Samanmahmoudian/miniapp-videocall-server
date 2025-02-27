import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server , Socket} from 'socket.io';
import { SignalingService } from './signaling.service';
import { measureMemory } from 'vm';
let first_state = ''
let second_state = ''

@WebSocketGateway({cors:{origin:'*'}})
export class SignalingGateway implements OnGatewayDisconnect {
constructor( private signalingService:SignalingService){}
@WebSocketServer()
server:Server

private clients = new Map()


async newCall(client:Socket){
  const checkState = await this.signalingService.check_state(client.id)
  if(checkState == 'required'){
    first_state =  client.id
  }else if(checkState == 'connected'){
    second_state =  client.id
    if (first_state !== '') {
      const target = await this.clients.get(first_state);
      if (target) {
          target.emit('offer_state', { state: 'ready', partnerId:  second_state });
          client.emit('offer_state', { state: 'connected', partnerId:  first_state });
      }
  }else{
    this.newCall(client)
  }
  }else{
    this.newCall(client)
  }
}



@SubscribeMessage('readytostart')
async handleStart(@ConnectedSocket() client:Socket){
   this.clients.set(client.id , client)
   client.emit('my_id' , client.id)
   this.newCall(client)
}

async handleDisconnect(client: Socket) {
  if(first_state == client.id){
    first_state = ''
  }else if(second_state == client.id){
    second_state = ''
  }
  this.handleDisconnected(client.id , client)
   this.clients.delete(client.id)

}
@SubscribeMessage('offer')
async handleOffer(@MessageBody() message , @ConnectedSocket() client:Socket){
  const target =  await this.clients.get(message.to)
  if(target){
    await target.emit('offer' , message.offer)
  }

}

@SubscribeMessage('answer')
async handleAnswer(@MessageBody() message , @ConnectedSocket() client:Socket){
    const target = await  this.clients.get(message.to)
    if(target){
       target.emit('answer' , message.answer)
    }else{
      console.log('answer is undefined')
    }

}

@SubscribeMessage('ice')
async handleIce(@MessageBody() message , @ConnectedSocket() client:Socket){
  const target =  await this.clients.get(message.to)
  if(target){
     target.emit('ice' , message.ice)
  }
}

@SubscribeMessage('nextcall')
async handleNextcall(@MessageBody() message , @ConnectedSocket() client:Socket){
const target =  await this.clients.get(message)
if(target){
   await target.emit('nextcall' , message)
}
  if(first_state == client.id){
    first_state = ''
  }else if(second_state == client.id){
    second_state = ''
  }
}

@SubscribeMessage('startnewcall')
async handleStartNewCall( @ConnectedSocket() client:Socket){
  await this.newCall(client)


}


@SubscribeMessage('disconnected')
async handleDisconnected(@MessageBody() message , @ConnectedSocket() client:Socket){
  client.broadcast.emit('disconnected' , message)


}

}
