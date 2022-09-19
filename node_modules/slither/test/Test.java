import java.io.*;
import java.util.*;

public class Test {
	public static void main(String[] args) throws Exception {
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		PrintWriter pw = new PrintWriter(System.out);

		int x = Integer.parseInt(br.readLine());

		switch (x) {
			case 1: // Intentionally time out
				Thread.sleep(5000);
				break;

			case 2: // Intentionally error
				throw new Exception();

			case 3: // Intentionally wrong answer
				pw.println("hi");
				break;

			case 4: // Intentially run out of memory
				OomWrapper oom = new OomWrapper(null, null);

				while (true) {
					oom = new OomWrapper(new byte[10000000], oom);
				}

			case 5: // Print a debug line, then the right answer
				pw.println("# This should still work");
				pw.println(5);
				break;

			default: // Correct answer: echo input
				pw.println(x);
				break;
		}

		br.close();
		pw.close();
	}

	static class OomWrapper {
		byte[] buffer;
		OomWrapper next;

		public OomWrapper(byte[] buffer, OomWrapper next) {
			this.buffer = buffer;
			this.next = next;
		}
	}
}