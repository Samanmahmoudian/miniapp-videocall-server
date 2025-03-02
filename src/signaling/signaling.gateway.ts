import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { subscribe } from 'diagnostics_channel';
import { query } from 'express';
import { Server, Socket } from 'socket.io';
let queue:any[] = []

@WebSocketGateway({cors:true})
export class SignalingGateway implements OnGatewayConnection , OnGatewayDisconnect{
  @WebSocketServer()
  server:Server
  private clients = new Map()

    async handleConnection(client:Socket) {
        const userTelegramId = await client.handshake.query.userTelegramId
        if(this.clients.has(userTelegramId)){
          await this.clients.delete(userTelegramId)
        }
        await this.clients.set(userTelegramId , client)
      }
    async handleDisconnect(client:Socket) {

 
        for (let [key , value] of this.clients.entries()){
          if(value == client){
            client.broadcast.emit('message' , {type: 'disconnect' , data: {key}})
            this.clients.delete(key)
          }
        }
    }

    async startNewCall(TelegramId){
      if(queue.length == 0){
        queue.push(TelegramId)
      }else if(queue.length == 1){
          const caller = await this.clients.get(TelegramId)
          const callee = await this.clients.get(queue[0])
          if(callee){
            caller.emit('message' , {type: 'caller' , data: {partnerId: queue[0]}})
            callee.emit('message' , {type: 'callee' , data: {partnerId: TelegramId}})
            queue = []
          }else{
            this.startNewCall(TelegramId)
          }
      
      }else if(queue.length > 1){
        const caller = await this.clients.get(queue[0])
        const callee = await this.clients.get(queue[1])
        if(caller && callee){
          await caller.emit('startNewCall' , {partnerId: queue[1]})
          queue = []
        }else{
          this.startNewCall(TelegramId) 
        }

    }
  }

  @SubscribeMessage('startNewCall')
  async handleStartNewCall(@MessageBody() telegramId , @ConnectedSocket() client:Socket){
    await this.startNewCall(telegramId)
  }


  @SubscribeMessage('message')
  async handleOffer(@MessageBody() message , @ConnectedSocket() client:Socket){
    const target =  await this.clients.get(message.to)
    if(target){
      await target.emit('message' , {type: message.type , data: message.data})
    }
  }

}
