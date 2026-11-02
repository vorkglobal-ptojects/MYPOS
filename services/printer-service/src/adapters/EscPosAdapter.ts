import type { PrinterAdapter } from '../types/printer';

export class EscPosAdapter implements PrinterAdapter {
  
  init(): Uint8Array {
    return new Uint8Array([0x1B, 0x40]); // ESC @
  }

  text(content: string, bold = false, doubleWidth = false, doubleHeight = false): Uint8Array {
    const commands: number[] = [];
    
    // Set text style
    let mode = 0;
    if (bold) mode |= 0x08;
    if (doubleHeight) mode |= 0x10;
    if (doubleWidth) mode |= 0x20;
    
    commands.push(0x1B, 0x21, mode); // ESC ! n
    
    // Convert string to ASCII bytes (assuming English/ASCII for basic ESC/POS)
    for (let i = 0; i < content.length; i++) {
      commands.push(content.charCodeAt(i) & 0xFF);
    }
    
    // Reset style
    commands.push(0x1B, 0x21, 0x00);
    
    return new Uint8Array(commands);
  }

  feed(lines = 3): Uint8Array {
    return new Uint8Array([0x1B, 0x64, lines]); // ESC d n
  }

  cut(): Uint8Array {
    return new Uint8Array([0x1D, 0x56, 0x41, 0x00]); // GS V A 0 (Partial Cut)
  }

  barcode(data: string): Uint8Array {
    const commands: number[] = [];
    // Set HRI characters position below barcode
    commands.push(0x1D, 0x48, 0x02); 
    // Set barcode height
    commands.push(0x1D, 0x68, 0x50);
    // Print Code 128
    commands.push(0x1D, 0x6B, 0x49, data.length);
    for (let i = 0; i < data.length; i++) {
      commands.push(data.charCodeAt(i));
    }
    return new Uint8Array(commands);
  }

  qrcode(data: string): Uint8Array {
    const commands: number[] = [];
    const len = data.length + 3;
    const pL = len & 0xFF;
    const pH = (len >> 8) & 0xFF;

    // Model 2
    commands.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Size
    commands.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08);
    // Error correction (M)
    commands.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);
    // Store data
    commands.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      commands.push(data.charCodeAt(i));
    }
    // Print
    commands.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    
    return new Uint8Array(commands);
  }
}
