import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server , Socket} from 'socket.io';
import { SignalingService } from './signaling.service';
let first_state = ''
let second_state = ''

@WebSocketGateway({cors:{origin:'*'}})
export class SignalingGateway implements OnGatewayConnection {
constructor( private signalingService:SignalingService){}
@WebSocketServer()
server:Server

private clients = new Map()

async handleConnection(@ConnectedSocket() client: Socket) {
await this.clients.set(client.id , client)
await client.emit('my_id' , client.id)
const checkState = await this.signalingService.check_state(client.id)
if(checkState == 'required'){
  first_state = await client.id
}else{
  second_state = await checkState?.second
  const target = await this.clients.get(first_state)
  await target.emit('offer_state', {state:'ready' , partnerId:second_state})
  await client.emit('offer_state' , {state:'connected' , partnerId:first_state})
  first_state = ''
  second_state = ''
}
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
  console.log(message.ice)
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
}

@SubscribeMessage('startnewcall')
async handleStartNewCall(@MessageBody() message , @ConnectedSocket() client:Socket){
  if(message){
    const checkState = await this.signalingService.check_state(client.id)
    if(checkState == 'required'){
      first_state = await client.id
    }else{
      second_state = await checkState?.second
      const target = await this.clients.get(first_state)
      await target.emit('offer_state', {state:'ready' , partnerId:second_state})
      first_state = ''
      second_state = ''
    }
    
  }

}

@SubscribeMessage('trackadded')
async handleTrack(@MessageBody() message , @ConnectedSocket() client:Socket){
  const target = await this.clients.get(message.to)
  if(target){
    await target.emit('trackadded' , message.trackadded)
  }

}

}
