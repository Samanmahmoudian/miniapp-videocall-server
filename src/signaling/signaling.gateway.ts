import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server , Socket} from 'socket.io';


@WebSocketGateway({cors:{origin:'*'}})
export class SignalingGateway implements OnGatewayConnection {

@WebSocketServer()
server:Server

async handleConnection(client: Socket) {
console.log(client.id + ' is Connected')
}

@SubscribeMessage('offer')
async handleOffer(@MessageBody() offer , @ConnectedSocket() client:Socket){
  client.broadcast.emit('offer' , offer)
}

@SubscribeMessage('answer')
async handleAnswer(@MessageBody() answer , @ConnectedSocket() client:Socket){
  client.broadcast.emit('answer' , answer)
}

@SubscribeMessage('ice')
async handleIce(@MessageBody() ice , @ConnectedSocket() client:Socket){
  client.broadcast.emit('ice' , ice)
}

@SubscribeMessage('endcall')
async handleEndcall(@MessageBody() endcall , @ConnectedSocket() client:Socket){
  client.broadcast.emit('endcall' , endcall)
}

@SubscribeMessage('error')
async handleError(@MessageBody() error){
  console.log(error)
}
}
