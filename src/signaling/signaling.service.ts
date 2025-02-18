import { Injectable } from '@nestjs/common';
let first_state = ''
let second_state = ''
@Injectable()
export class SignalingService {

     check_state(clientId){
        if(first_state == ''){
            first_state =  clientId
            return 'required'
        }else if(first_state && second_state==''){
            let first =  first_state
            first_state = ''
            return 'connected'
        }
    }
}
