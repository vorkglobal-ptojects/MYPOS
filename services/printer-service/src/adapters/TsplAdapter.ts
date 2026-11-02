import type { PrinterAdapter } from '../types/printer';

export class TsplAdapter implements PrinterAdapter {
  
  private encoder = new TextEncoder();

  public cmd(str: string): Uint8Array {
    return this.encoder.encode(str + '\r\n');
  }

  init(widthMm = 40, heightMm = 30): Uint8Array {
    const commands: Uint8Array[] = [];
    commands.push(this.cmd(`SIZE ${widthMm} mm, ${heightMm} mm`));
    commands.push(this.cmd('GAP 2 mm, 0 mm'));
    commands.push(this.cmd('DIRECTION 1'));
    commands.push(this.cmd('CLS')); // Clear buffer
    
    return this.concat(commands);
  }

  text(content: string, x = 10, y = 10, size = 16, bold = false): Uint8Array {
    // Basic TSPL text: TEXT x,y,"font",rotation,x-multiplier,y-multiplier,"content"
    // Using default font "TSS24.BF2" (supports Chinese/English usually) or "2"
    return this.cmd(`TEXT ${Math.round(x)},${Math.round(y)},"TSS24.BF2",0,1,1,"${content}"`);
  }

  barcode(data: string, x = 10, y = 50): Uint8Array {
    // BARCODE X,Y,"code type",height,human readable,rotation,narrow,wide,"content"
    return this.cmd(`BARCODE ${Math.round(x)},${Math.round(y)},"128",40,1,0,2,2,"${data}"`);
  }

  qrcode(data: string, x = 10, y = 100): Uint8Array {
    // QRCODE X,Y,ECC Level,cell width,mode,rotation,"content"
    return this.cmd(`QRCODE ${Math.round(x)},${Math.round(y)},H,4,A,0,"${data}"`);
  }

  box(x: number, y: number, width: number, height: number): Uint8Array {
    // BOX x_start, y_start, x_end, y_end, line_thickness
    const xEnd = Math.round(x + width);
    const yEnd = Math.round(y + height);
    return this.cmd(`BOX ${Math.round(x)},${Math.round(y)},${xEnd},${yEnd},2`);
  }

  print(): Uint8Array {
    return this.cmd('PRINT 1,1');
  }

  feed(lines = 1): Uint8Array {
    return this.cmd('FORMFEED');
  }

  cut(): Uint8Array {
    return this.cmd('CUT');
  }

  public concat(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }
    return result;
  }
}
