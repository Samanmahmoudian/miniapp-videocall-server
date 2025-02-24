import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server , Socket} from 'socket.io';
import { SignalingService } from './signaling.service';
let first_state = ''
let second_state = ''

@WebSocketGateway({cors:{origin:'*'}})
export class SignalingGateway implements OnGatewayConnection , OnGatewayDisconnect {
constructor( private signalingService:SignalingService){}
@WebSocketServer()
server:Server

private clients = new Map()


async newCall(client:Socket){
  const checkState = await this.signalingService.check_state(client.id)
  if(checkState == 'required'){
    first_state = await client.id
  }else if(checkState == 'connected'){
    second_state = await client.id
    if (first_state !== '') {
      const target = this.clients.get(first_state);
      if (target) {
          await target.emit('offer_state', { state: 'ready', partnerId: second_state });
          await client.emit('offer_state', { state: 'connected', partnerId: first_state });
      }
  }else{
    this.newCall(client)
  }
  }
}

async handleConnection( client: Socket) {
await this.clients.set(client.id , client)
await client.emit('my_id' , client.id)
await this.newCall(client)
}



async handleDisconnect(client: Socket) {
  this.server.emit('disconnected' , client.id)
}
@SubscribeMessage('offer')
async handleOffer(@MessageBody() message , @ConnectedSocket() client:Socket){
  const target = await this.clients.get(message.to)
  await target.emit('offer' , message.offer)
}

@SubscribeMessage('answer')
async handleAnswer(@MessageBody() message , @ConnectedSocket() client:Socket){
    const target =  await this.clients.get(message.to)
    if(target){
      await target.emit('answer' , message.answer)
    }else{
      console.log('answer is undefined')
    }

}

@SubscribeMessage('ice')
async handleIce(@MessageBody() message , @ConnectedSocket() client:Socket){
  const target = await this.clients.get(message.to)
  if(target){
    await target.emit('ice' , message.ice)
  }else{
    console.log('ice is undefined')
  }
}

@SubscribeMessage('endcall')
async handleEndcall(@MessageBody() message , @ConnectedSocket() client:Socket){
  const target = await this.clients.get(message.to)
  await target.emit('endcall' , message.endcall)
  if(first_state == client.id){
    first_state = ''
  }else if(second_state == client.id){
    second_state = ''
  }
}

@SubscribeMessage('startnewcall')
async handleStartNewCall(@MessageBody() message , @ConnectedSocket() client:Socket){
if(message){
  this.handleConnection(client)
}

}


@SubscribeMessage('disconnected')
async handleDisconnected(@MessageBody() message , @ConnectedSocket() client:Socket){
  client.broadcast.emit('disconnected' , message)
  if(first_state == client.id){
    first_state = ''
  }else if(second_state == client.id){
    second_state = ''
  }

}

@SubscribeMessage('error')
async handleError(@MessageBody() message , @ConnectedSocket() client:Socket){
if(message){
console.log(message)
}

}


}
