export class TsplAdapter {
  private encoder = new TextEncoder();

  /**
   * Helper to convert string command to Uint8Array with CRLF
   */
  public cmd(str: string): Uint8Array {
    return this.encoder.encode(str + '\r\n');
  }

  /**
   * Initialize label configuration
   * @param widthMm Label width in mm (default 50mm)
   * @param heightMm Label height in mm (default 30mm)
   * @param gapMm Gap between labels in mm (default 2mm)
   */
  init(widthMm = 50, heightMm = 30, gapMm = 2): Uint8Array {
    const commands: Uint8Array[] = [];
    commands.push(this.cmd(`SIZE ${widthMm} mm, ${heightMm} mm`));
    commands.push(this.cmd(`GAP ${gapMm} mm, 0 mm`));
    commands.push(this.cmd('DIRECTION 1'));
    commands.push(this.cmd('CLS')); // Clear image buffer
    return this.concat(commands);
  }

  /**
   * Add QR code command
   * @param data Content to encode in QR code
   * @param x X coordinate in dots (203 dpi: 8 dots = 1mm)
   * @param y Y coordinate in dots
   * @param cellWidth QR cell size (1-10, default 4)
   */
  qrcode(data: string, x = 15, y = 15, cellWidth = 4): Uint8Array {
    // QRCODE X,Y,ECC Level,cell width,mode,rotation,"content"
    // Clean string to single line so newlines don't break TSPL command protocol
    const cleanData = data.replace(/[\r\n]+/g, ' | ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.cmd(`QRCODE ${Math.round(x)},${Math.round(y)},L,${cellWidth},A,0,"${cleanData}"`);
  }

  /**
   * Add text line command
   * @param content Text string
   * @param x X coordinate in dots
   * @param y Y coordinate in dots
   * @param font TSPL font name ("3", "2", "1", "TSS24.BF2")
   * @param xMult Horizontal multiplier
   * @param yMult Vertical multiplier
   */
  text(content: string, x = 140, y = 20, font = "3", xMult = 1, yMult = 1): Uint8Array {
    // TEXT X,Y,"font",rotation,x-multiplier,y-multiplier,"content"
    // Escape quotes if any
    const safeContent = content.replace(/"/g, '\\"');
    return this.cmd(`TEXT ${Math.round(x)},${Math.round(y)},"${font}",0,${xMult},${yMult},"${safeContent}"`);
  }

  /**
   * Issue print command
   * @param sets Number of sets to print
   * @param copies Copies per set
   */
  print(sets = 1, copies = 1): Uint8Array {
    return this.cmd(`PRINT ${sets},${copies}`);
  }

  /**
   * Formfeed to next label gap
   */
  feed(): Uint8Array {
    return this.cmd('FORMFEED');
  }

  /**
   * Concatenate Uint8Arrays into single payload
   */
  public concat(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}
