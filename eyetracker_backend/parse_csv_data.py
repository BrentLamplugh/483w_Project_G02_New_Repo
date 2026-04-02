# imports:      
# import pandas to handle csv parsing
from flask import Flask, jsonify, request
import pandas as pd
import io

# Answer User Story: "As a researcher, I want to export eye-tracking data as a CSV file so that it can be used in external analysis tools."

""" 
Parsing Flow:

In Python file:
1. Read the csv file from React into a pandas DataFrame
2. Parse the DataFrame 
    - Make seperate dfs for each type of data structrue (Heatmap, Scanpath, Fiaxtion Map)
3. Use jsonify to convert the parsed DataFrames into JSON format

In React:
1. Use the JSON data to create the visualizations (Heatmap, Scanpath, Fiaxtion Map, Fixation Durations, and AOIs)
 - parse function returns the JSON files 
"""

# Flask app setup - Temporary
app = Flask(__name__)
@app.route('/upload', methods=['POST'])

def parse_csv():

    # read the csv file into a pandas DataFrame - TEMPORARY
    file = request.files['file']  # 'file' must match the key from frontend
    df = pd.read_csv(io.BytesIO(file.read()))  # read directly from memory, no temp file needed

    """ Parsing """
    # Heatmap
    hm_df = df[['MEDIA_ID', 'BPOGX', 'BPOGY', 'BPOGV', 'TIME']] # df of exact data values needed for heatmap
    hm_df = hm_df[hm_df['BPOGV'] == 1] # filter for valid gaze points - cleaning data; only want valid gaze points
    hm_df = hm_df.drop(columns=['BPOGV'])  # drop validity column after filtering
    hm_df = hm_df.rename(columns={'MEDIA_ID': 'id', 'BPOGX': 'x', 'BPOGY': 'y', 'TIME': 'timestamp'}) # rename columns for clarity

    # Scanpath
    sp_df = df[['MEDIA_ID', 'FPOGX', 'FPOGY', 'FPOGID', 'FPOGV', 'FPOGS', 'TIME']] # df of exact data values needed for scanpath
    sp_df = sp_df[sp_df['FPOGV'] == 1] # filter for valid gaze points
    sp_df = sp_df.drop(columns=['FPOGV'])  # drop validity column after filtering
    sp_df = sp_df.rename(columns={'MEDIA_ID': 'id', 'FPOGX': 'x', 'FPOGY': 'y', 'FPOGID': 'gaze_id', 'FPOGS': 'gaze_start_time', 'TIME': 'timestamp'}) # rename columns for clarity


    # Fiaxtion Map
    fm_df = df[['MEDIA_ID', 'FPOGX', 'FPOGY', 'FPOGD', 'FPOGID', 'FPOGV']] # df of exact data values needed for fixation map
    fm_df = fm_df[fm_df['FPOGV'] == 1] # filter for valid gaze points
    fm_df = fm_df.drop(columns=['FPOGV'])  # drop validity column after filtering
    fm_df = fm_df.rename(columns={'MEDIA_ID': 'id', 'FPOGX': 'x', 'FPOGY': 'y', 'FPOGD': 'duration', 'FPOGID': 'gaze_id'}) # rename columns for clarity

    # Give the parsed data back to React in JSON format
    return jsonify({
        "heatmap": hm_df.to_dict(orient='records'),
        "scanpath": sp_df.to_dict(orient='records'),
        "fixation_map": fm_df.to_dict(orient='records')
    })


"""
Converted JSON file

{
  "heatmap": [
    { "x": 0.45, "y": 0.32 },
    { "x": 0.46, "y": 0.33 }
  ],
  "fixations": [
    { "x": 0.50, "y": 0.40, "duration": 0.320, "id": 1 },
    { "x": 0.61, "y": 0.55, "duration": 0.180, "id": 2 }
  ]
}
"""


# Test the Flask app
if __name__ == "__main__":
    app.run(debug=True)
