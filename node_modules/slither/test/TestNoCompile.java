import java.io.*;
import java.util.*;

public class TestNoCompile {
	public static void main(String[] args) throws Exception {
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		PrintWriter pw = new PrintWriter(System.out);

		this line should not compile :)

		br.close();
		pw.close();
	}
}