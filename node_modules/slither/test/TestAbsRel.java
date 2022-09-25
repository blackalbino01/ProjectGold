import java.io.*;
import java.util.*;

public class TestAbsRel {
	public static void main(String[] args) throws Exception {
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		PrintWriter pw = new PrintWriter(System.out);

		int x = Integer.parseInt(br.readLine());

		switch (x) {
			case 1: // Intentionally wrong answer (invalid)
				pw.println("hi");
				break;

			case 2: // First yellow, second green
				pw.println(2.001 + " " + 1.0001);
				break;

			case 3: // Wrong number of tokens
				pw.println(3);
				break;

			case 4: // Print a debug line, then a correct
				pw.println("# This should still work");
				pw.println(4.000000001234543 + " " + 3.00001234543235);
				break;

			case 5: // Intentionally wrong answer (out of range)
				pw.println(5.01 + " " + 6.02);
				break;

			default: // Correct answer: echo input, then (input - 1)
				pw.println(x + " " + (x - 1));
				break;
		}

		br.close();
		pw.close();
	}
}