import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
let queue:String[] = []

@WebSocketGateway({cors:{origin:'https://front-n04k.onrender.com'}})
export class SignalingGateway implements OnGatewayConnection , OnGatewayDisconnect{
  @WebSocketServer()
  server:Server
  private clients = new Map()

    async handleConnection(client:Socket) {
        const userTelegramId = await String(client.handshake.query.userTelegramId)
        if(this.clients.has(userTelegramId)){
          await this.clients.delete(userTelegramId)
        }
        await this.clients.set(userTelegramId , client)
        console.log(userTelegramId)
      }


    async handleDisconnect(client:Socket) {
        for (let [key , value] of this.clients.entries()){
          if(value == client){
            client.broadcast.emit('disconnected' , key)
            queue = await queue.filter(keys => keys !== key)
            this.clients.delete(key)
            console.log(queue)
          }
        }
    }

    async startNewCall(TelegramId){
      if(!queue.indexOf(TelegramId)){
        await queue.push(TelegramId)
      }
      await this.connectClients()
  }

  async connectClients(){
    while(queue.length>0 && queue.length % 2 == 0){
      const caller = await this.clients.get(queue[0])
      const callee = await this.clients.get(queue[1])
      await queue.splice(0,2)
      if(caller && callee){
        await caller.emit('caller' , queue[1])
        await callee.emit('callee' , queue[0])
      }
    }
  }


  @SubscribeMessage('startNewCall')
  async handleStartNewCall(@MessageBody() telegramId , @ConnectedSocket() client:Socket){
    await this.startNewCall(telegramId)
  }




  @SubscribeMessage('ice')
  async handleIce(@MessageBody() message , @ConnectedSocket() client:Socket){
    const target = await this.clients.get(message.to)
    if (target){
      await target.emit('ice' , message.data)
    }
  }

  @SubscribeMessage('offer')
  async handleOffer(@MessageBody() message , @ConnectedSocket() client:Socket){
    const target = await this.clients.get(message.to)
    if (target){
      await target.emit('offer' , message.data)
    }
  }

  @SubscribeMessage('answer')
  async handleAnswer(@MessageBody() message , @ConnectedSocket() client:Socket){
    const target = await this.clients.get(message.to)
    if (target){
      await target.emit('answer' , message.data)
    }
  }


  @SubscribeMessage('nextcall')
  async handleNextCall(@MessageBody() Id , @ConnectedSocket() client:Socket){
    const target = await this.clients.get(Id)
    if (target){
      await target.emit('nextcall' , 'nextcall')
    }
  }
}
