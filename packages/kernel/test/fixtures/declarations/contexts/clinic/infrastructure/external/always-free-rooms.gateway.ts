import { Gateway } from '../../../../../../../src/declarations.js';
import { Rooms } from '../../application/ports/rooms.port.js';

@Gateway(Rooms, { replaces: true })
export class AlwaysFreeRooms implements Rooms {
  async isFree(): Promise<boolean> {
    return true;
  }
}
